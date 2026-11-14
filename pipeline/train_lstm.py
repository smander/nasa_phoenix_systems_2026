"""Train the mission neural network: an LSTM with attention (browser side: src/core/neuralSeq.ts).

It reads each stay hour by hour (156, 240 or 336 hours). Every hour has seven inputs: Sun margin, Sun up, Earth margin,
Earth up, battery reserve / 120 h, Earth contact needed / 100, and 156 / hours in the stay. One LSTM layer feeds an
attention head per mission rule; each rule's logit comes from its attention-weighted summary and the last hidden state.
Training stays come from 45 sites in 2026-2028; 9 other sites and the year 2029 are held out and scored once at the end.

Usage:  npx vite-node tools/nn/nn_dataset.ts  &&  .venv/bin/python -m pipeline.train_lstm      (needs PyTorch)
        BENCH=1 ... times a few batches on each device and exits;  EPOCHS=n overrides the number of passes.
Writes: apps/web/public/data/nn/lstm.bin (float32 LE, in the order read by seqModelFromBuffer), apps/web/public/data/nn/lstm.json,
        packages/core/fixtures/lstm_fixture.json (parity check for the TypeScript forward pass).
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

import numpy as np
import torch
from torch import nn

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data' / 'raw' / 'nn'
OUT = ROOT / 'apps' / 'web' / 'public' / 'data' / 'nn'
INPUTS, HIDDEN, ATT, HEAD = 7, 64, 32, 48
UNSURE = (0.1, 0.9)
BASE_HOURS = 156


class MissionLSTM(nn.Module):
    def __init__(self, rules: int):
        super().__init__()
        self.lstm = nn.LSTM(INPUTS, HIDDEN, batch_first=True)
        self.att1, self.att2 = nn.Linear(HIDDEN, ATT), nn.Linear(ATT, rules)
        self.head = nn.Linear(2 * HIDDEN, HEAD)
        self.out_w = nn.Parameter(torch.randn(rules, HEAD) * (1.0 / HEAD ** 0.5))
        self.out_b = nn.Parameter(torch.zeros(rules))

    def forward(self, x):
        hs, (h_last, _) = self.lstm(x)                                   # hs: batch x hours x hidden
        alpha = torch.softmax(self.att2(torch.tanh(self.att1(hs))), dim=1)  # batch x hours x rules, sums to 1 over hours
        ctx = torch.einsum('btr,bth->brh', alpha, hs)                    # one summary per rule
        z = torch.cat([ctx, h_last[-1].unsqueeze(1).expand(-1, ctx.shape[1], -1)], dim=2)
        hid = torch.relu(self.head(z))
        return (hid * self.out_w).sum(-1) + self.out_b, alpha


def features(sq: torch.Tensor, p: torch.Tensor, scale: float) -> torch.Tensor:
    """int16 margins (batch x hours x 2) and settings (batch x 2) -> the seven inputs per hour."""
    b, t, _ = sq.shape
    q = sq.float()
    m = torch.clamp(q / scale / 6.0, -1, 1)
    up = (q > 0).float()
    const = torch.cat([p, torch.full((b, 1), BASE_HOURS / t, device=p.device)], dim=1).unsqueeze(1).expand(-1, t, -1)
    return torch.cat([m[:, :, 0:1], up[:, :, 0:1], m[:, :, 1:2], up[:, :, 1:2], const], dim=2)


def main() -> None:
    meta = json.loads((DATA / 'meta.json').read_text())
    n, r, maxh, scale = meta['rows'], len(meta['rules']), meta['maxHours'], float(meta['marginScale'])
    SQ = np.fromfile(DATA / 'S.i16', dtype='<i2').reshape(n, maxh, 2)
    LEN = np.fromfile(DATA / 'len.u16', dtype='<u2')
    P = np.fromfile(DATA / 'P.f32', dtype='<f4').reshape(n, 2)
    Y = np.fromfile(DATA / 'Y.u8', dtype=np.uint8).reshape(n, r).astype(np.float32)
    split = np.fromfile(DATA / 'split.u8', dtype=np.uint8)
    rng = np.random.default_rng(1)                       # validation slice: 5% of the training stays
    tr = rng.permutation(np.flatnonzero(split == 0))
    nv = len(tr) // 20
    val, tr = tr[:nv], tr[nv:]

    torch.manual_seed(7)
    lengths = sorted(int(v) for v in np.unique(LEN))

    def batches(idx, size, shuffle, gen=None):
        out = []
        for t in lengths:
            ii = idx[LEN[idx] == t]
            if shuffle:
                ii = ii[gen.permutation(len(ii))]
            out += [(t, ii[k:k + size]) for k in range(0, len(ii), size)]
        if shuffle:
            out = [out[k] for k in gen.permutation(len(out))]
        return out

    def load(t, ii, dev):
        return (features(torch.from_numpy(SQ[ii, :t]).to(dev), torch.from_numpy(P[ii]).to(dev), scale), torch.from_numpy(Y[ii]).to(dev))

    if os.environ.get('BENCH'):
        for name in ['cpu'] + (['mps'] if torch.backends.mps.is_available() else []):
            dev = torch.device(name)
            model = MissionLSTM(r).to(dev); opt = torch.optim.Adam(model.parameters(), 2e-3)
            bs = batches(tr[:20000], 512, True, np.random.default_rng(0))[:12]
            t0 = time.time()
            for t, ii in bs:
                x, y = load(t, ii, dev)
                loss = nn.functional.binary_cross_entropy_with_logits(model(x)[0], y)
                opt.zero_grad(); loss.backward(); opt.step()
            if name == 'mps':
                torch.mps.synchronize()
            print(f'{name}: {(time.time() - t0) / len(bs):.3f} s per batch of 512 -> {(time.time() - t0) / len(bs) * len(tr) / 512 / 60:.1f} min per pass')
        return

    dev = torch.device(os.environ.get('DEVICE', 'cpu'))
    model = MissionLSTM(r).to(dev)
    epochs = int(os.environ.get('EPOCHS', '14'))
    opt = torch.optim.Adam(model.parameters(), 2e-3)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=3e-3, total_steps=epochs * (len(tr) // 512 + 4), pct_start=0.15)
    gen = np.random.default_rng(7)

    @torch.no_grad()
    def predict(idx):
        model.eval()
        p = np.zeros((len(idx), r), np.float32)
        pos = {int(v): k for k, v in enumerate(idx)}
        for t, ii in batches(idx, 2048, False):
            out = torch.sigmoid(model(load(t, ii, dev)[0])[0]).cpu().numpy()
            p[[pos[int(v)] for v in ii]] = out
        model.train()
        return p

    def score(idx):
        p, y = predict(idx), Y[idx]
        ok = (p >= 0.5) == (y > 0.5)
        unsure = (p > UNSURE[0]) & (p < UNSURE[1])
        return {'ruleAccuracy': [round(float(v), 4) for v in ok.mean(0)], 'allRules': round(float(ok.all(1).mean()), 4), 'stays': int(len(idx)),
                '_wrong': int((~ok).sum()), '_wrongUnsure': int((~ok & unsure).sum()), '_unsure': int(unsure.sum()), '_n': int(ok.size)}

    print(f'training on {len(tr)} stays, validating on {len(val)}; LSTM {INPUTS}->{HIDDEN}, attention {ATT}, head {HEAD}; {sum(p.numel() for p in model.parameters())} weights; device {dev}', flush=True)
    best, best_acc, t0 = None, -1.0, time.time()
    for ep in range(epochs):
        tot, cnt = 0.0, 0
        for t, ii in batches(tr, 512, True, gen):
            x, y = load(t, ii, dev)
            loss = nn.functional.binary_cross_entropy_with_logits(model(x)[0], y)
            opt.zero_grad(); loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step(); sched.step()
            tot += loss.item() * len(ii); cnt += len(ii)
        s = score(val)
        acc = float(np.mean(s['ruleAccuracy']))
        if acc > best_acc:
            best_acc, best = acc, {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
        print(f'  pass {ep + 1:>2}/{epochs}  loss {tot / cnt:.4f}  validation: rules {acc:.4f}, all five {s["allRules"]:.4f}  ({(time.time() - t0) / 60:.1f} min)', flush=True)
    model.load_state_dict(best)

    sites_s, year_s = score(np.flatnonzero(split == 1)), score(np.flatnonzero(split == 2))
    wrong = sites_s['_wrong'] + year_s['_wrong']
    held = [s['id'] for s in meta['sites'] if s['held']]
    report = {
        'trainedOn': {'stays': int(len(tr)), 'sites': len(meta['sites']) - len(held), 'years': '2026–2028'},
        'unseenSites': {k: v for k, v in sites_s.items() if not k.startswith('_')} | {'sites': len(held), 'siteIds': held},
        'unseenYear': {k: v for k, v in year_s.items() if not k.startswith('_')} | {'year': meta['heldYear']},
        'unsureBand': list(UNSURE),
        'errorsFlaggedUnsure': round((sites_s['_wrongUnsure'] + year_s['_wrongUnsure']) / max(1, wrong), 4),
        'shareUnsure': round((sites_s['_unsure'] + year_s['_unsure']) / (sites_s['_n'] + year_s['_n']), 4),
        'validationAccuracy': round(best_acc, 4),
    }
    sd = {k: v.numpy() for k, v in best.items()}
    order = [sd['lstm.weight_ih_l0'], sd['lstm.weight_hh_l0'], sd['lstm.bias_ih_l0'] + sd['lstm.bias_hh_l0'],
             sd['att1.weight'], sd['att1.bias'], sd['att2.weight'], sd['att2.bias'], sd['head.weight'], sd['head.bias'], sd['out_w'], sd['out_b']]
    assert all(np.isfinite(a).all() for a in order), 'non-finite weights'
    OUT.mkdir(parents=True, exist_ok=True)
    np.concatenate([a.ravel() for a in order]).astype('<f4').tofile(OUT / 'lstm.bin')
    (OUT / 'lstm.json').write_text(json.dumps({
        'inputs': INPUTS, 'hidden': HIDDEN, 'att': ATT, 'head': HEAD, 'rules': meta['rules'], 'bin': 'data/nn/lstm.bin',
        'perHour': ['Sun margin (deg / 6, clipped to ±1)', 'Sun up (0 or 1)', 'Earth margin (deg / 6, clipped to ±1)', 'Earth up (0 or 1)',
                    'battery reserve / 120 h', 'Earth contact needed / 100', '156 / hours in the stay'],
        'training': f'LSTM {INPUTS}->{HIDDEN} (one layer), attention {ATT} with one head per rule, output head {HEAD}; binary cross-entropy, Adam with a one-cycle '
                    f'learning rate, {epochs} passes; PyTorch {torch.__version__} (pipeline/train_lstm.py); labels from the direct calculation',
        'report': report,
    }, indent=1, ensure_ascii=False))

    # parity fixture: a few held-out stays with this model's outputs and where each rule's attention peaks
    model.eval()
    fix = []
    held_idx = np.flatnonzero(split == 1)
    for t in lengths:
        for i in held_idx[LEN[held_idx] == t][:2]:
            with torch.no_grad():
                logits, alpha = model(load(t, np.array([i]), dev)[0])
            a = alpha[0].cpu().numpy()                    # hours x rules
            fix.append({'q': SQ[i, :t].reshape(-1).tolist(), 'reserve': float(P[i, 0]), 'go': float(P[i, 1]),
                        'p': [round(float(v), 6) for v in torch.sigmoid(logits)[0].cpu().numpy()],
                        'peak': [int(v) for v in a.argmax(0)], 'peakWeight': [round(float(v), 6) for v in a.max(0)], 'y': [int(v) for v in Y[i]]})
    (ROOT / 'packages' / 'core' / 'fixtures' / 'lstm_fixture.json').write_text(json.dumps(fix))
    print(json.dumps(report, indent=1, ensure_ascii=False))
    print(f'lstm.bin {(OUT / "lstm.bin").stat().st_size // 1024} KB, {(time.time() - t0) / 60:.1f} min')


if __name__ == '__main__':
    main()
