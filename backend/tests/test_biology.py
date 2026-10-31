import numpy as np
from scipy.integrate import solve_ivp

from app.core.biology import granulopoiesis as g
from app.core.biology.forecast import forecast
from app.core.trajectory import neutrophil_engraftment_day


def test_gpu_kernel_matches_scipy_reference():
    mtt, gamma, seed = 9.0, 0.17, 1.5
    ktr = 4 / mtt

    def rhs(_, s):
        p, t1, t2, t3, n = s
        fb = (g.STEADY_STATE_ANC / max(n, 1.0)) ** gamma
        return [ktr * p * (fb - 1), ktr * (p - t1), ktr * (t1 - t2), ktr * (t2 - t3), ktr * (t3 - n)]

    ref = solve_ivp(rhs, (0, 30), [seed, 0, 0, 0, g.RESIDUAL_ANC], t_eval=np.arange(31), rtol=1e-9, atol=1e-9).y[4]
    sim = g.to_numpy(g.simulate([mtt], [gamma], [seed], days=30))[0]
    assert np.max(np.abs(sim - ref) / np.maximum(ref, 1.0)) < 0.01


def test_engraftment_day_is_first_post_nadir_crossing():
    anc = np.array([[100, 40, 10, 120, 600, 900], [100, 50, 20, 30, 40, 60]], dtype=float)
    days = g.to_numpy(g.engraftment_day(anc))
    assert days[0] == 4 and np.isinf(days[1])


def test_three_consecutive_day_rule():
    assert neutrophil_engraftment_day({10: 520, 11: 480, 12: 600, 13: 650, 14: 700}) == 12
    assert neutrophil_engraftment_day({-1: 3000, 0: 2500, 14: 600}) is None


def test_forecast_follows_the_patients_own_counts():
    pre = {"cd34_dose": 6.4, "stem_cell_source": "Peripheral blood", "hla_match": "9/10"}
    prior = forecast(pre, [])
    fast = forecast(pre, [{"day": 5, "value": 90}, {"day": 8, "value": 180}, {"day": 10, "value": 340}])
    slow = forecast(pre, [{"day": 10, "value": 20}, {"day": 14, "value": 30}, {"day": 18, "value": 40}])
    assert fast["median_engraftment_day"] < prior["median_engraftment_day"] < slow["median_engraftment_day"]
    assert slow["delayed_engraftment_risk"] and not fast["delayed_engraftment_risk"]
    assert all(lo <= m <= hi for lo, m, hi in zip(prior["lower_95"], prior["median"], prior["upper_95"]))
