# GPU simulation report (2026-10-31T00:53:13+00:00)

Device: NVIDIA GeForce RTX 3050 6GB Laptop GPU · 6.44 GB · CuPy 14.2.0 · Python 3.12.3

## Granulopoiesis model (fused CUDA RK4 kernel, FP32)

| Particles | GPU s | Particles/s | CPU FP64 s | Speed-up | Max rel. error | Median engraftment day |
|---|---|---|---|---|---|---|
| 1,000 | 0.0007 | 1,355,997 | 0.097 | 131.5 | 1.8e-06 | 16.0 |
| 10,000 | 0.0012 | 8,107,696 | 0.657 | 532.7 | 1.8e-06 | 16.0 |
| 100,000 | 0.0078 | 12,753,347 | – | – | – | 16.0 |
| 1,000,000 | 0.0576 | 17,357,535 | – | – | – | 16.0 |

## Calibration to the UCI cohort (held-out 20%)

80% interval coverage 79%, 95% coverage 92%, median absolute error 2.0 days (cohort-median baseline 2.0).

## Forecasts for cohort patients (pre-transplant data only)

| Observed day | Forecast median | 80% interval | P(≤14) | P(≤21) | P(≤28) | s |
|---|---|---|---|---|---|---|
| 13 | 15.0 | [12.0, 18.0] | 48% | 99% | 100% | 0.112 |
| 23 | 16.0 | [13.0, 20.0] | 22% | 95% | 100% | 0.066 |
| 18 | 17.0 | [14.0, 21.0] | 17% | 93% | 100% | 0.066 |
| 16 | 15.0 | [13.0, 19.0] | 36% | 98% | 100% | 0.065 |
| 14 | 14.0 | [12.0, 17.0] | 55% | 100% | 100% | 0.069 |
| 18 | 14.0 | [12.0, 17.0] | 53% | 100% | 100% | 0.065 |
| 17 | 14.0 | [12.0, 17.0] | 56% | 100% | 100% | 0.063 |
| 15 | 15.0 | [12.0, 18.0] | 46% | 99% | 100% | 0.063 |

## Qiskit Aer statevector, ZZ feature map (GPU vs CPU)

| Qubits | Amplitudes | GPU s | CPU s | Speed-up | Max amplitude difference |
|---|---|---|---|---|---|
| 16 | 65,536 | 0.0086 | 0.0146 | 1.7 | 2.4e-16 |
| 20 | 1,048,576 | 0.0424 | 0.1334 | 3.15 | 1.0e-16 |
| 24 | 16,777,216 | 0.8138 | 1.443 | 1.77 | 5.7e-17 |

Total run time 11.7 s.
