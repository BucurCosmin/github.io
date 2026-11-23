"""Verificări ale modelului față de teoria din Curs 4 și cerințele IACS UR M3.
Rulare: python -m pytest -q
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sim import Simulation, F_N, P_N_KW  # noqa: E402


def ready(mode="droop"):
    s = Simulation()
    s.command({"cmd": "mode", "value": mode})
    s.command({"cmd": "engine_start"})
    s.step(6.0)
    s.command({"cmd": "acb_close"})
    s.step(1.0)
    assert s.g.acb
    return s


def record(s, T, dt=0.02):
    out = []
    t0 = s.t
    while s.t - t0 < T:
        s.step(dt)
        out.append((s.t - t0, s.state()["f"], s.state()["p_kw"]))
    return out


def test_mers_in_gol_la_f0():
    s = ready()
    s.step(8.0)
    assert abs(s.state()["f"] - 52.0) < 0.05          # f0 = 52 Hz cu statism 4 %


def test_statism_static():
    """Δf = −s·f_n·P/P_n (Curs 4, rel. 9)."""
    s = ready()
    for fid in ("sw", "lo", "erf", "air"):
        s.command({"cmd": "feeder_start", "id": fid})
        s.step(4.0)
    st = record(s, 6.0)[-1]
    expected = 52.0 - 0.04 * F_N * st[2] / P_N_KW
    assert abs(st[1] - expected) < 0.1


def test_izocron_revine_la_50Hz():
    s = ready("iso")
    s.command({"cmd": "feeder_start", "id": "crane"})
    assert abs(record(s, 10.0)[-1][1] - 50.0) < 0.05


def test_treapta_de_sarcina_UR_M3():
    """Treaptă ≈ 1/3 Pn cu pornire directă: abatere < 10 %, revenire în ±1 % în < 5 s."""
    s = ready()
    for fid in ("crane", "bal"):
        s.command({"cmd": "feeder_start", "id": fid})
    rec = record(s, 12.0)
    f_end = rec[-1][1]
    f_min = min(r[1] for r in rec)
    assert (52.0 - f_min) / F_N < 0.10
    t_rec = max((t for t, f, _ in rec if abs(f - f_end) > 0.01 * F_N), default=0.0)
    assert t_rec < 5.0


def test_aruncare_de_sarcina_fara_supraturatie():
    s = ready()
    for fid in ("sw", "lo", "erf", "air", "fire", "crane"):
        s.command({"cmd": "feeder_start", "id": fid})
        s.step(3.0)
    s.step(5.0)
    s.command({"cmd": "acb_open"})
    rec = record(s, 6.0)
    assert max(r[1] for r in rec) < 1.15 * F_N
    assert s.g.engine_run


def test_deconectare_preferentiala_la_suprasarcina():
    s = ready()
    for fid in ("sw", "lo", "erf", "air", "fire", "bal", "crane", "ac", "galley", "light"):
        s.command({"cmd": "feeder_start", "id": fid})
        s.step(3.0)
    s.command({"cmd": "demand", "id": "bt", "value": 0.4})
    s.g.acb and s.command({"cmd": "feeder_start", "id": "bt"})
    s.step(15.0)
    assert s.alarms["PT1"].latched or s.alarms["HL"].latched


def test_marire_consemn_ridica_frecventa():
    s = ready()
    s.command({"cmd": "feeder_start", "id": "crane"})
    s.step(6.0)
    f1 = s.state()["f"]
    s.command({"cmd": "raise", "value": -1})
    s.step(2.0)
    s.command({"cmd": "raise", "value": 0})
    s.step(4.0)
    assert s.state()["f"] < f1 - 0.3
