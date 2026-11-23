"""Modelul dinamic al unui grup diesel-generator naval cu consumatori.

Mărimi raportate (u.r.) la puterea nominală P_n și la turația nominală n_n.
Ecuația de mișcare (Curs 4, rel. 4):   2H · dω/dt = P_m − P_e − pierderi
"""
from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass, field

# ---------------------------------------------------------------- date nominale
P_N_KW = 400.0          # puterea nominală a grupului
S_N_KVA = 500.0         # puterea aparentă nominală a generatorului (cos φ = 0,8)
U_N = 400.0             # tensiunea nominală [V]
F_N = 50.0              # frecvența nominală [Hz]
N_N = 1500.0            # turația nominală [rot/min] (generator cu 4 poli)
I_N = S_N_KVA * 1000 / (math.sqrt(3) * U_N)   # ≈ 722 A


@dataclass
class Consumer:
    id: str
    name: str
    p_kw: float                 # puterea absorbită nominală (electrică)
    cos_n: float = 0.85
    kind: str = "pump"          # pump (P~ω³), torque (P~ω), resistive (P~1), drive (VFD)
    start_s: float = 2.0        # durata pornirii directe [s]
    group: str = "esential"     # esential / neesential (deconectare preferențială)
    pref_stage: int = 0         # 0 = nu se deconectează; 1, 2 = treapta de deconectare
    # stare
    on: bool = False
    t_on: float = 0.0
    tripped: bool = False
    demand: float = 1.0         # pentru acționări cu VFD (thruster): 0…1
    ramp: float = 0.0           # puterea curentă a VFD (rampă)

    def power(self, w: float, v: float, dt: float) -> tuple[float, float]:
        """Returnează (P, Q) în u.r. față de P_N_KW."""
        if not self.on:
            self.ramp = 0.0
            return 0.0, 0.0
        self.t_on += dt
        pr = self.p_kw / P_N_KW
        tg = math.tan(math.acos(self.cos_n))
        if self.kind == "drive":
            # convertizor de frecvență: rampă de putere, cos φ ≈ 0,95 la rețea
            target = self.demand
            rate = 0.12 * dt        # 12 %/s
            self.ramp += max(-4 * rate, min(rate, target - self.ramp))
            p = pr * self.ramp
            return p, p * 0.33
        if self.kind == "resistive":
            return pr * v * v, pr * v * v * tg
        exp = 3.0 if self.kind == "pump" else 1.0
        if self.t_on < self.start_s:
            # pornire directă: curent 6·In → In, cos φ 0,2 → cos φn
            x = self.t_on / self.start_s
            i_rel = 5.5 - 4.5 * x ** 3
            cos = 0.18 + (self.cos_n - 0.18) * x ** 2
            s_n = pr / (0.9 * self.cos_n)
            p = s_n * i_rel * cos * v * v * min(1.0, w)
            q = s_n * i_rel * math.sqrt(1 - cos * cos) * v * v
            return p, q
        p = pr * (w ** exp)
        return p, p * tg


def default_consumers() -> list[Consumer]:
    return [
        Consumer("sw", "Pompă apă de mare răcire", 30, 0.86, "pump", 1.5, "esential"),
        Consumer("lo", "Pompă ulei ungere", 22, 0.85, "pump", 1.2, "esential"),
        Consumer("erf", "Ventilatoare CM", 45, 0.86, "pump", 2.0, "esential"),
        Consumer("air", "Compresor aer pornire", 37, 0.85, "torque", 2.5, "esential"),
        Consumer("fire", "Pompă incendiu", 45, 0.87, "pump", 2.5, "esential"),
        Consumer("bal", "Pompă balast", 55, 0.87, "pump", 3.0, "neesential", 2),
        Consumer("crane", "Macara de marfă", 75, 0.86, "torque", 3.0, "neesential", 2),
        Consumer("ac", "Climatizare", 45, 0.86, "torque", 2.5, "neesential", 1),
        Consumer("galley", "Cambuză", 40, 1.0, "resistive", 0.0, "neesential", 1),
        Consumer("light", "Iluminat", 20, 0.95, "resistive", 0.0, "esential"),
        Consumer("bt", "Thruster prova (VFD)", 200, 0.95, "drive", 0.0, "neesential"),
    ]


@dataclass
class Alarm:
    code: str
    text: str
    active: bool = False
    acked: bool = True
    latched: bool = False       # a fost activă și nu a fost resetată


ALARMS = [
    ("LF", "FRECVENȚĂ SCĂZUTĂ < 47,5 Hz"),
    ("HF", "FRECVENȚĂ RIDICATĂ > 52,5 Hz"),
    ("LV", "TENSIUNE SCĂZUTĂ < 90 %"),
    ("OL", "SUPRASARCINĂ GENERATOR > 100 %"),
    ("PT1", "DECONECTARE PREFERENȚIALĂ TR. 1"),
    ("PT2", "DECONECTARE PREFERENȚIALĂ TR. 2"),
    ("UF", "DECLANȘARE ACB – SUBFRECVENȚĂ"),
    ("OC", "DECLANȘARE ACB – SUPRACURENT"),
    ("OS", "SUPRATURAȚIE – OPRIRE MOTOR"),
    ("BO", "BLACK-OUT"),
    ("HL", "CERERE CONSUMATOR MARE REFUZATĂ"),
    ("SL", "LIMITARE COMBUSTIBIL (BOOST)"),
]


@dataclass
class Genset:
    # parametri motor / generator
    H: float = 1.2              # constanta de inerție [s] (motor + volant + generator)
    T_comb: float = 0.06        # constanta de timp a arderii [s]
    dead: float = 0.03          # timp mort injecție [s]
    T_turbo: float = 2.0        # constanta de timp a turbosuflantei [s]
    p_loss0: float = 0.08       # pierderi la mers în gol (u.r. la ω = 1)
    xd_tr: float = 0.18         # reactanța tranzitorie (pentru căderea de tensiune)
    T_avr: float = 0.35         # constanta de timp AVR [s]
    # regulator
    mode: str = "droop"         # droop / iso
    droop: float = 0.04
    kp: float = 25.0
    ki: float = 20.0
    kd: float = 1.0
    load_anticip: bool = False
    k_ff: float = 0.8
    n_set: float = 1.04         # consemn de turație la mers în gol (u.r.)
    # stare
    w: float = 0.0
    pm: float = 0.0
    boost: float = 0.0
    rack: float = 0.0
    integ: float = 0.0
    e_prev: float = 0.0
    p_meas: float = 0.0
    v_dip: float = 0.0
    q_prev: float = 0.0
    p_prev: float = 0.0
    t_exh: float = 80.0
    engine_run: bool = False
    starting: float = 0.0       # timp rămas pentru lansare
    acb: bool = False
    raise_cmd: int = 0          # +1 mărire, −1 micșorare
    fuel_limited: bool = False


class Simulation:
    DT = 0.002

    def __init__(self) -> None:
        self.g = Genset()
        self.loads = default_consumers()
        self.t = 0.0
        self.delay = deque([0.0] * max(1, int(self.g.dead / self.DT)))
        self.alarms = {c: Alarm(c, txt) for c, txt in ALARMS}
        self.timers: dict[str, float] = {}
        self.events: list[str] = []
        self.pe = 0.0
        self.qe = 0.0
        self.v = 0.0

    # ------------------------------------------------------------ comenzi
    def command(self, msg: dict) -> None:
        c = msg.get("cmd")
        g = self.g
        if c == "engine_start" and not g.engine_run:
            g.engine_run, g.starting = True, 2.5
            g.integ = 0.12
            self._log("Pornire motor DG1")
        elif c == "engine_stop":
            self._open_acb("Oprire motor – ACB deschis")
            g.engine_run = False
            self._log("Oprire motor DG1")
        elif c == "acb_close":
            if g.engine_run and g.starting <= 0 and abs(g.w * F_N - F_N) < 2.5 and self.v > 0.9:
                g.acb = True
                self.alarms["BO"].active = False
                self._log("ACB DG1 închis – barele sunt sub tensiune")
            else:
                self._log("Închidere ACB refuzată: motorul nu a ajuns la turație/tensiune")
        elif c == "acb_open":
            self._open_acb("ACB deschis manual")
        elif c == "feeder_start":
            ld = self._load(msg.get("id"))
            if ld and not ld.on:
                if not g.acb:
                    self._log(f"{ld.name}: bare fără tensiune")
                    return
                need = ld.p_kw * (ld.demand if ld.kind == "drive" else 1.0)
                if ld.p_kw >= 150 and not self._reserve_ok(need):
                    self._set_alarm("HL", True)
                    self._log(f"{ld.name}: rezervă insuficientă ({need:.0f} kW cerut) – pornire blocată")
                    return
                ld.on, ld.t_on, ld.tripped = True, 0.0, False
                self._log(f"Pornit: {ld.name}")
        elif c == "feeder_stop":
            ld = self._load(msg.get("id"))
            if ld and ld.on:
                ld.on = False
                self._log(f"Oprit: {ld.name}")
        elif c == "demand":
            ld = self._load(msg.get("id"))
            if ld:
                ld.demand = max(0.0, min(1.0, float(msg.get("value", 0))))
        elif c == "mode":
            g.mode = "iso" if msg.get("value") == "iso" else "droop"
            self._log(f"Regulator: {'IZOCRON' if g.mode == 'iso' else 'STATISM'}")
        elif c == "droop":
            g.droop = max(0.0, min(0.08, float(msg.get("value", 4)) / 100))
        elif c == "raise":
            g.raise_cmd = int(msg.get("value", 0))
        elif c == "anticip":
            g.load_anticip = bool(msg.get("value"))
        elif c == "ack":
            for a in self.alarms.values():
                a.acked = True
        elif c == "reset":
            for a in self.alarms.values():
                if not a.active:
                    a.latched = False
            self._set_alarm("HL", False)
        elif c == "reset_sim":
            self.__init__()

    def _load(self, lid):
        return next((x for x in self.loads if x.id == lid), None)

    def _reserve_ok(self, kw: float) -> bool:
        return self.pe * P_N_KW + kw <= 0.9 * P_N_KW

    def _log(self, s: str) -> None:
        self.events.append(f"{self.t:7.1f} s  {s}")
        self.events = self.events[-40:]

    def _open_acb(self, why: str) -> None:
        if self.g.acb:
            self.g.acb = False
            for ld in self.loads:
                if ld.on:
                    ld.on = False
                    ld.tripped = True
            self._log(why)
            if self.g.engine_run:
                self._set_alarm("BO", True)

    def _set_alarm(self, code: str, state: bool) -> None:
        a = self.alarms[code]
        if state and not a.active:
            a.acked = False
            a.latched = True
        a.active = state

    def _timer(self, key: str, cond: bool, dt: float, limit: float) -> bool:
        self.timers[key] = self.timers.get(key, 0.0) + dt if cond else 0.0
        return self.timers[key] >= limit

    # ------------------------------------------------------------ integrare
    def step(self, dt_total: float) -> None:
        if dt_total <= 0:
            return
        n = max(1, round(dt_total / self.DT))
        for _ in range(n):
            self._substep(self.DT)

    def _substep(self, dt: float) -> None:
        g = self.g
        self.t += dt
        # ---- consemn (mărire / micșorare: 0,5 %/s din turația nominală)
        if g.raise_cmd:
            g.n_set = max(0.9, min(1.12, g.n_set + g.raise_cmd * 0.005 * dt))
        # ---- sarcina electrică
        v = self.v
        p_tot = q_tot = 0.0
        if g.acb:
            for ld in self.loads:
                p, q = ld.power(g.w, max(v, 0.3), dt)
                p_tot += p
                q_tot += q
        self.pe, self.qe = p_tot, q_tot
        # ---- AVR: cădere instantanee proporțională cu treapta de Q, revenire exponențială
        dq = (q_tot - g.q_prev) * P_N_KW / S_N_KVA
        g.v_dip += g.xd_tr * dq
        g.v_dip -= g.v_dip / g.T_avr * dt
        g.q_prev = q_tot
        vf = min(1.0, g.w / 0.95) if g.engine_run else 0.0      # limitare V/Hz
        self.v = max(0.0, (1.0 - g.v_dip) * vf)
        # ---- regulator de turație
        g.p_meas += (p_tot - g.p_meas) * dt / 0.1
        droop = g.droop if g.mode == "droop" else 0.0
        n_ref = (g.n_set if g.mode == "droop" else 1.0 + (g.n_set - 1.04)) - droop * g.p_meas
        if g.starting > 0:
            g.starting -= dt
            rack_cmd = 0.25 if g.w < 0.95 else 0.12
            g.integ = rack_cmd
        else:
            e = n_ref - g.w
            de = (e - g.e_prev) / dt
            g.e_prev = e
            g.integ += g.ki * e * dt
            ff = g.k_ff * (p_tot - g.p_prev) / dt * 0.02 if g.load_anticip else 0.0
            rack_cmd = g.kp * e + g.integ + g.kd * de + ff
        g.p_prev = p_tot
        # limitare de fum (boost) și limite absolute
        rack_max = min(1.1, 0.62 + 0.55 * g.boost)
        rack = max(0.0, min(rack_cmd, rack_max))
        g.fuel_limited = rack_cmd > rack_max + 1e-3 and g.starting <= 0
        if rack_cmd != rack:                        # anti-windup
            g.integ -= (rack_cmd - rack) * 0.5
            g.integ = max(-0.2, min(1.2, g.integ))
        if not g.engine_run:
            rack = 0.0
            g.integ = 0.0
        g.rack = rack
        # ---- motorul: timp mort + întârziere ardere + turbosuflantă
        self.delay.append(rack)
        r_eff = self.delay.popleft()
        g.pm += (r_eff * max(g.w, 0.05) - g.pm) * dt / g.T_comb
        g.boost += (min(1.1, max(0.0, r_eff - 0.05)) - g.boost) * dt / g.T_turbo
        loss = g.p_loss0 * g.w * g.w + 0.02 * g.w
        if g.starting > 0 and g.w < 0.3:
            g.pm = max(g.pm, 0.15)                  # aer de lansare
        # ---- ecuația de mișcare
        g.w += (g.pm - p_tot - loss) / (2 * g.H * max(g.w, 0.2)) * dt
        g.w = max(0.0, g.w)
        g.t_exh += ((90 + 380 * min(1.2, g.pm)) * (1 if g.engine_run else 0.2) - g.t_exh) * dt / 8.0
        self._protections(dt)

    def _protections(self, dt: float) -> None:
        g = self.g
        f = g.w * F_N
        i_rel = math.hypot(self.pe, self.qe) * P_N_KW / S_N_KVA / max(self.v, 0.3)
        on_bus = g.acb
        # alarme cu temporizare (ca la un sistem de alarmă real)
        self._set_alarm("LF", self._timer("a_lf", on_bus and f < 47.5, dt, 1.0))
        self._set_alarm("HF", self._timer("a_hf", g.engine_run and f > 52.5, dt, 1.0))
        self._set_alarm("LV", self._timer("a_lv", on_bus and self.v < 0.9, dt, 1.5))
        self._set_alarm("OL", self._timer("a_ol", on_bus and self.pe > 1.0, dt, 2.0))
        self._set_alarm("SL", self._timer("a_sl", on_bus and g.fuel_limited, dt, 0.5))
        # supraturație 115 %
        if g.engine_run and g.w > 1.15:
            self._set_alarm("OS", True)
            self._open_acb("Supraturație – oprire motor")
            g.engine_run = False
        # deconectare preferențială: tr. 1 la P > 100 % timp de 3 s, tr. 2 la P > 105 % timp de 1 s
        if self._timer("pt1", on_bus and self.pe > 1.0, dt, 3.0):
            self._pref_trip(1)
        if self._timer("pt2", on_bus and self.pe > 1.05, dt, 1.0):
            self._pref_trip(2)
        # subfrecvență: < 46 Hz timp de 2 s → declanșare ACB
        if self._timer("uf", on_bus and f < 46.0, dt, 2.0):
            self._set_alarm("UF", True)
            self._open_acb("Declanșare ACB pe subfrecvență")
        # subfrecvență treapta rapidă: < 42,5 Hz timp de 0,3 s
        if self._timer("uf2", on_bus and f < 42.5, dt, 0.3):
            self._set_alarm("UF", True)
            self._open_acb("Declanșare ACB pe subfrecvență (treapta rapidă)")
        # supracurent temporizat: > 1,3 In timp de 4 s
        if self._timer("oc", on_bus and i_rel > 1.3, dt, 4.0):
            self._set_alarm("OC", True)
            self._open_acb("Declanșare ACB pe supracurent")

    def _pref_trip(self, stage: int) -> None:
        hit = [ld for ld in self.loads if ld.on and 0 < ld.pref_stage <= stage]
        for ld in hit:
            ld.on, ld.tripped = False, True
        if hit:
            self._set_alarm(f"PT{stage}", True)
            self._log(f"Deconectare preferențială tr. {stage}: " + ", ".join(x.name for x in hit))
        self.timers[f"pt{stage}"] = 0.0

    # ------------------------------------------------------------ stare pentru UI
    def state(self) -> dict:
        g = self.g
        s = math.hypot(self.pe, self.qe)
        return {
            "t": round(self.t, 2),
            "f": g.w * F_N,
            "rpm": g.w * N_N,
            "p_kw": self.pe * P_N_KW,
            "q_kvar": self.qe * P_N_KW,
            "i_a": s * P_N_KW * 1000 / (math.sqrt(3) * U_N * max(self.v, 0.3)) if g.acb else 0.0,
            "v": self.v * U_N,
            "cos": (self.pe / s) if s > 1e-4 else 1.0,
            "rack": g.rack * 100,
            "boost": g.boost * 2.6,                      # bar (aprox.)
            "t_exh": g.t_exh,
            "lo_p": 4.6 * min(1.0, g.w) ** 2 if g.engine_run else 0.0,
            "n_set": g.n_set,
            "f_noload": (g.n_set if g.mode == "droop" else 1.0 + (g.n_set - 1.04)) * F_N,
            "mode": g.mode,
            "droop": g.droop * 100,
            "anticip": g.load_anticip,
            "engine": g.engine_run,
            "starting": g.starting > 0,
            "acb": g.acb,
            "fuel_limited": g.fuel_limited,
            "loads": [{"id": x.id, "name": x.name, "kw": x.p_kw, "on": x.on, "tripped": x.tripped,
                       "group": x.group, "stage": x.pref_stage, "kind": x.kind, "demand": x.demand,
                       "start": x.on and x.kind not in ("resistive", "drive") and x.t_on < x.start_s}
                      for x in self.loads],
            "alarms": [{"code": a.code, "text": a.text, "active": a.active, "acked": a.acked, "latched": a.latched}
                       for a in self.alarms.values()],
            "events": self.events[-12:],
            "p_n": P_N_KW, "i_n": I_N,
        }
