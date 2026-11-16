#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simulator – Principiul modulatorului hidraulic ABS echipat cu supape electromagnetice 2/2
Curs 3 – Sisteme de siguranță activă (ABS), Fig. 2

Rulare:   python simulator_modulator_ABS.py
Cerințe:  Python 3.8+ (folosește doar biblioteca standard: tkinter, math)

Ce conține:
  • schema animată a Fig. 2: pedală (3), servofrână (2), cilindru principal cu rezervor (1),
    cameră de amortizare (5), pompă de retur (6), supapă de admisie 2/2 normal deschisă (7),
    supapă de evacuare 2/2 normal închisă (8), acumulator (9), frâna roții (4);
    culoarea lichidului = presiunea, bulinele albe = sensul și debitul lichidului;
  • modelul unui sfert de vehicul (roată + 1/4 din masă) cu curbe μ–λ Burckhardt
    pentru asfalt uscat/ud, zăpadă, gheață și schimbări bruște de aderență;
  • trei moduri:
      Manual      – studentul comandă supapele (1 = creștere, 2 = menținere, 3 = scădere)
                    și pedala (săgeți sus/jos); implicit vehiculul este pe un „stand cu role”
                    (viteză constantă), iar tasta V readuce vehiculul la v₀;
      ABS automat – ECU simplificat după ciclul Bosch (praguri −a, +a, +A, λ1, viteză de referință);
      Fără ABS    – frânare convențională, pentru comparație (roata se blochează);
  • grafice: viteze vehicul/roată/referință, presiuni, accelerația roții cu pragurile,
    alunecarea cu pragul λ1 și starea bobinelor 7 și 8;
  • fereastră 3D (butonul „Vedere 3D”): pedală, servofrână, cilindru principal, bloc hidraulic
    cu supapele 7/8 (bloc transparent sau opac), pompă, acumulator, ECU, conductă, etrier,
    disc, roată dințată și senzor de turație – sincronizată cu simularea; rotire cu mouse-ul;
  • rezultatele ultimelor opriri (distanță, timp) pentru comparația ABS / fără ABS.

Valorile modelului sunt didactice (ordin de mărime realist), nu ale unui sistem anume.
"""
import math

G = 9.81

# Curbe μ(λ) – modelul Burckhardt: μ = c1·(1 − e^(−c2·λ)) − c3·λ
SURFACES = {
    'Asfalt uscat': (1.2801, 23.990, 0.5200),
    'Asfalt ud':    (0.8570, 33.822, 0.3470),
    'Zăpadă':       (0.1946, 94.129, 0.0646),
    'Gheață':       (0.0500, 306.39, 0.0000),
}

SCENARIOS = {
    'Asfalt uscat': ('Asfalt uscat', None, None),
    'Asfalt ud': ('Asfalt ud', None, None),
    'Zăpadă': ('Zăpadă', None, None),
    'Gheață': ('Gheață', None, None),
    'Uscat → gheață (la 1,2 s)': ('Asfalt uscat', 'Gheață', 1.2),
    'Gheață → uscat (la 1,2 s)': ('Gheață', 'Asfalt uscat', 1.2),
}


def mu_of(surface, lam):
    c1, c2, c3 = SURFACES[surface]
    lam = min(max(lam, 0.0), 1.0)
    return max(c1 * (1.0 - math.exp(-c2 * lam)) - c3 * lam, 0.0)


def mu_peak(surface):
    best_l, best_m = 0.0, 0.0
    for i in range(1, 400):
        l = i / 400
        m = mu_of(surface, l)
        if m > best_m:
            best_l, best_m = l, m
    return best_l, best_m


# Stările regulatorului ABS (fazele ciclului de control)
ST_BUILD, ST_HOLD1, ST_DUMP, ST_HOLD2, ST_FAST, ST_STEP = range(6)
STATE_NAMES = {
    ST_BUILD: 'Frânare normală – presiunea crește',
    ST_HOLD1: 'Menținere presiune (prag −a depășit)',
    ST_DUMP:  'Scădere presiune (alunecare > λ1)',
    ST_HOLD2: 'Menținere presiune (roata reaccelerează)',
    ST_FAST:  'Creștere presiune (accelerație > +A)',
    ST_STEP:  'Creștere presiune în trepte',
}

MODE_MANUAL, MODE_ABS, MODE_NOABS = 'manual', 'abs', 'noabs'


class Simulator:
    # --- parametri vehicul (sfert de vehicul) ---
    m = 400.0          # kg – masa care revine roții
    r = 0.30           # m – raza dinamică
    J = 1.2            # kg·m² – momentul de inerție al roții
    kb = 15.0          # N·m/bar – cuplu de frânare per bar
    # --- parametri hidraulici ---
    p_max = 140.0      # bar – presiunea maximă în cilindrul principal
    tau_booster = 0.05 # s – întârzierea servofrânei
    C_w = 0.02         # cm³/bar – elasticitatea cilindrului de roată + conductă
    K_in = 2.0         # cm³/(s·√bar) – conductanța supapei de admisie (7)
    K_out = 2.5        # cm³/(s·√bar) – conductanța supapei de evacuare (8)
    C_acc = 1.0        # cm³/bar – acumulatorul de joasă presiune (9)
    V_acc_max = 3.0    # cm³
    Q_pump = 6.0       # cm³/s – debitul pompei de retur (6)
    # --- regulator ABS ---
    ecu_dt = 0.005     # s – perioada de calcul a ECU
    th_neg_a = -25.0   # m/s² – prag decelerație roată (−a)
    th_pos_a = 4.0     # m/s² – prag accelerație roată (+a)
    th_pos_A = 25.0    # m/s² – prag accelerație mare (+A)
    lam1 = 0.14        # prag de comutare a alunecării λ1
    v_min = 0.7        # m/s (≈2,5 km/h) – sub această viteză ABS nu reglează
    step_open = 0.003  # s – durata deschiderii la creșterea în trepte
    step_closed = 0.030
    dump_pulse = 0.010 # s – impuls de scădere pe aderență mică
    acc_filter = 0.004 # s – filtrarea semnalului de accelerație a roții
    dt = 0.0005

    def __init__(self, mode=MODE_ABS, scenario='Asfalt uscat', v0_kmh=80.0):
        self.mode = mode
        self.set_scenario(scenario)
        self.reset(v0_kmh)

    def set_scenario(self, scenario):
        self.scenario = scenario
        self.surf0, self.surf1, self.t_switch = SCENARIOS[scenario]

    def surface(self):
        if self.surf1 and self.t >= self.t_switch:
            return self.surf1
        return self.surf0

    def reset(self, v0_kmh=None):
        if v0_kmh is not None:
            self.v0 = v0_kmh / 3.6
        self.t = 0.0
        self.v = self.v0
        self.omega = self.v0 / self.r
        self.x = 0.0
        self.pedal = 0.0           # cerere șofer 0..1
        self.p_mc = 0.0            # presiune cilindru principal [bar]
        self.p_w = 0.0             # presiune cilindru de roată [bar]
        self.V_acc = 0.0           # volum în acumulator [cm³]
        self.in_energized = False  # supapa 7 normal deschisă → energizată = închisă
        self.out_energized = False # supapa 8 normal închisă → energizată = deschisă
        self.pump_on = False
        self.q_in = self.q_out = self.q_pump = 0.0
        self.wheel_acc = 0.0       # accelerația periferică a roții [m/s²]
        self.v_ref = self.v0
        self.decel_est = 0.0
        self.lam = 0.0
        self.lam_ecu = 0.0
        self.mu = 0.0
        self.Fx = 0.0
        self.Mb = 0.0
        self.abs_active = False
        self.state = ST_BUILD
        self.state_t = 0.0
        self.was_above_pa = False
        self.ecu_timer = 0.0
        self.stopped = False
        self.t_stop = None
        self.hist = []             # (t, v, v_wheel, v_ref, p_w, p_mc, lam, a_w, state, in, out, lam_ecu)
        self.hist_dt = 0.005
        self._hist_timer = 0.0
        self.manual_pedal = 0.0
        self.hold_speed = True     # mod manual: vehicul pe stand cu role (viteză constantă)
        self.t_brake = 0.3         # momentul apăsării pedalei (moduri automate)
        self.panic_rise = 0.15

    # ------------------------------------------------------------------
    def driver(self):
        if self.mode == MODE_MANUAL:
            return self.manual_pedal
        if self.t < self.t_brake:
            return 0.0
        return min((self.t - self.t_brake) / self.panic_rise, 1.0)

    def valve_states(self):
        """Returnează (admisie_deschisă, evacuare_deschisă)."""
        return (not self.in_energized, self.out_energized)

    # ------------------------------------------------------------------
    def ecu(self):
        """Logica ABS (simplificată după ciclul Bosch)."""
        aw, lam = self.wheel_acc, self.lam_ecu   # alunecarea calculată de ECU din viteza de referință
        dt = self.ecu_dt
        self.state_t += dt
        if self.v_ref < self.v_min or self.p_mc < 1.0:
            self.abs_active = False
            self._set(ST_BUILD)
            return
        s = self.state
        if not self.abs_active:
            if aw < self.th_neg_a:
                self.abs_active = True
                self._set(ST_HOLD1)
            return
        if lam > 0.5 and s != ST_DUMP:        # siguranță: roată aproape blocată
            self._set(ST_DUMP)
            return
        if s == ST_BUILD:
            if aw < self.th_neg_a:
                self._set(ST_HOLD1)
        elif s == ST_HOLD1:
            if lam > self.lam1:
                self._set(ST_DUMP)
            elif aw > self.th_neg_a and self.state_t > 0.02:
                self._set(ST_STEP)          # prag −a atins în zona stabilă: nu se reduce
        elif s == ST_DUMP:
            if (aw > self.th_neg_a and lam < self.lam1) or aw > self.th_pos_a:
                self._set(ST_HOLD2)
        elif s == ST_HOLD2:
            if aw > self.th_pos_A:
                self._set(ST_FAST)
            elif aw > self.th_pos_a:
                self.was_above_pa = True
            elif self.was_above_pa and aw < self.th_pos_a:
                self._set(ST_STEP)
            elif lam > self.lam1 and self.state_t > 0.02:
                self._set(ST_DUMP)          # aderență mică: impuls suplimentar de scădere
            elif not self.was_above_pa and self.state_t > 0.25:
                self._set(ST_STEP)
        elif s == ST_FAST:
            if aw < self.th_pos_A:
                self.was_above_pa = True
                self._set(ST_HOLD2, keep_flag=True)
        elif s == ST_STEP:
            if aw < self.th_neg_a:
                self._set(ST_DUMP)          # faza 8: scădere imediată
        # comenzi supape în funcție de stare
        s = self.state
        if s in (ST_BUILD, ST_FAST):
            self.in_energized, self.out_energized = False, False
        elif s in (ST_HOLD1, ST_HOLD2):
            self.in_energized, self.out_energized = True, False
        elif s == ST_DUMP:
            self.in_energized, self.out_energized = True, True
        elif s == ST_STEP:
            per = self.step_open + self.step_closed
            phase = self.state_t % per
            self.in_energized = phase > self.step_open
            self.out_energized = False

    def _set(self, st, keep_flag=False):
        if st != self.state:
            self.state = st
            self.state_t = 0.0
            if not keep_flag:
                self.was_above_pa = False
            if st == ST_BUILD:
                self.in_energized = self.out_energized = False

    # ------------------------------------------------------------------
    def step(self):
        dt = self.dt
        if self.stopped:
            self.t += dt
            self.pedal = self.driver()
            self.p_mc += (self.pedal * self.p_max - self.p_mc) * dt / self.tau_booster
            if self.mode == MODE_MANUAL:
                self._hydraulics(dt)
            else:
                self.q_in = self.q_out = self.q_pump = 0.0
            self._log(dt)
            return
        self.pedal = self.driver()
        # servofrână + cilindru principal (întârziere de ordinul 1)
        self.p_mc += (self.pedal * self.p_max - self.p_mc) * dt / self.tau_booster

        # ECU
        if self.mode == MODE_ABS:
            self.ecu_timer += dt
            if self.ecu_timer >= self.ecu_dt:
                self.ecu_timer -= self.ecu_dt
                self.ecu()
            self.pump_on = self.abs_active or self.V_acc > 0.05
        elif self.mode == MODE_NOABS:
            self.in_energized = self.out_energized = False
            self.pump_on = False

        self._hydraulics(dt)

        # dinamica roții și a vehiculului
        surf = self.surface()
        vw = self.omega * self.r
        self.lam = min(max((self.v - vw) / max(self.v, 0.5), 0.0), 1.0)
        self.mu = mu_of(surf, self.lam)
        Fz = self.m * G
        self.Fx = self.mu * Fz
        self.Mb = self.kb * self.p_w
        omega_dot = (self.Fx * self.r - self.Mb) / self.J
        new_omega = self.omega + omega_dot * dt
        if new_omega < 0.0:
            new_omega = 0.0
            omega_dot = -self.omega / dt
        a_w_inst = omega_dot * self.r
        self.wheel_acc += (a_w_inst - self.wheel_acc) * min(dt / self.acc_filter, 1.0)
        self.omega = new_omega
        if not (self.mode == MODE_MANUAL and self.hold_speed):
            self.v -= self.Fx / self.m * dt
        if self.v < 0.0:
            self.v = 0.0
        self.x += self.v * dt

        # viteza de referință estimată de ECU (din vitezele roții + modelul presiunii)
        # (estimarea se actualizează doar cât timp roata urmărește vehiculul – zona stabilă)
        if abs(self.wheel_acc) < 15.0 and self.omega * self.r > 0.85 * self.v_ref:
            decel_now = max((self.Mb - self.J * omega_dot) / (self.r * self.m), 0.0)
            self.decel_est += (min(decel_now, 1.25 * G) - self.decel_est) * min(dt / 0.05, 1.0)
        self.v_ref = max(self.omega * self.r, self.v_ref - 1.05 * self.decel_est * dt)
        self.lam_ecu = min(max((self.v_ref - self.omega * self.r) / max(self.v_ref, 0.5), 0.0), 1.0)

        self.t += dt
        if self.v <= 0.05:
            self.v = 0.0
            self.omega = 0.0
            self.stopped = True
            self.t_stop = self.t
            self.lam, self.mu, self.wheel_acc = 0.0, 0.0, 0.0
            self.abs_active = False
            if self.mode != MODE_MANUAL:
                self.in_energized = self.out_energized = False
        self._log(dt)

    def restore_speed(self):
        """Readuce vehiculul la viteza inițială (roata reîncepe să se rotească)."""
        self.v = self.v0
        self.omega = self.v0 / self.r
        self.v_ref = self.v0
        self.stopped = False
        self.t_stop = None

    def _hydraulics(self, dt):
        p_acc = self.V_acc / self.C_acc
        inlet_open, outlet_open = self.valve_states()
        q_in = 0.0
        if inlet_open:
            dp = self.p_mc - self.p_w
            q_in = self.K_in * math.copysign(math.sqrt(abs(dp)), dp)
        elif self.p_w > self.p_mc + 0.5:
            # supapa de sens montată în paralel cu supapa de admisie: la eliberarea pedalei
            # lichidul revine din frână spre cilindrul principal chiar dacă supapa 7 e închisă
            q_in = -self.K_in * math.sqrt(self.p_w - self.p_mc)
        q_out = 0.0
        if outlet_open and self.p_w > p_acc and self.V_acc < self.V_acc_max:
            q_out = self.K_out * math.sqrt(self.p_w - p_acc)
        q_pump = 0.0
        if self.pump_on and self.V_acc > 0.0:
            q_pump = min(self.Q_pump, self.V_acc / dt)
        self.p_w = max(self.p_w + (q_in - q_out) * dt / self.C_w, 0.0)
        self.V_acc = min(max(self.V_acc + (q_out - q_pump) * dt, 0.0), self.V_acc_max)
        self.q_in, self.q_out, self.q_pump = q_in, q_out, q_pump

    def _log(self, dt):
        self._hist_timer += dt
        if self._hist_timer >= self.hist_dt:
            self._hist_timer = 0.0
            inlet_open, outlet_open = self.valve_states()
            self.hist.append((self.t, self.v * 3.6, self.omega * self.r * 3.6, self.v_ref * 3.6,
                              self.p_w, self.p_mc, self.lam, self.wheel_acc, self.state,
                              inlet_open, outlet_open, self.lam_ecu))
            if len(self.hist) > 14000:
                del self.hist[:2000]

    def run(self, seconds):
        n = int(seconds / self.dt)
        for _ in range(n):
            self.step()



import tkinter as tk
from tkinter import ttk

# ======================================================================
#  Interfața grafică
# ======================================================================

BG = '#f4f5f7'
INK = '#1d2433'
MUTED = '#6b7280'
C_VF = '#1f5fa8'     # viteză vehicul
C_VR = '#e07b00'     # viteză roată
C_REF = '#555555'    # viteză referință
C_PW = '#c0392b'     # presiune roată
C_PMC = '#7f8c8d'    # presiune cilindru principal
C_ACC = '#2e8b57'
C_ON = '#f39c12'     # bobină alimentată

PHASE_INFO = {
    'build': ('CREȘTERE PRESIUNE', '#2e8b57',
              'Supapa de admisie (7) NEALIMENTATĂ → DESCHISĂ\n'
              'Supapa de evacuare (8) NEALIMENTATĂ → ÎNCHISĂ\n'
              'Legătură directă cilindru principal → frână: presiunea la roată crește '
              'până la presiunea din cilindrul principal.'),
    'hold': ('MENȚINERE PRESIUNE', '#d68910',
             'Supapa de admisie (7) ALIMENTATĂ → ÎNCHISĂ\n'
             'Supapa de evacuare (8) NEALIMENTATĂ → ÎNCHISĂ\n'
             'Frâna este izolată: presiunea la roată rămâne constantă, chiar dacă '
             'șoferul apasă mai tare pedala.'),
    'dump': ('SCĂDERE PRESIUNE', '#c0392b',
             'Supapa de admisie (7) ALIMENTATĂ → ÎNCHISĂ\n'
             'Supapa de evacuare (8) ALIMENTATĂ → DESCHISĂ\n'
             'Lichidul trece din frână în acumulatorul (9); pompa de retur (6) îl '
             'trimite înapoi spre cilindrul principal → pulsații în pedală.'),
    'both': ('AMBELE SUPAPE DESCHISE', '#7d3c98',
             'Supapa 7 deschisă și supapa 8 deschisă: lichidul curge direct din '
             'cilindrul principal spre acumulator.\nCombinație care NU este folosită '
             'de ECU în funcționare normală.'),
}


def fmt(x, nd=1):
    return f'{x:.{nd}f}'.replace('.', ',')


def lerp_color(c1, c2, f):
    f = min(max(f, 0.0), 1.0)
    a = [int(c1[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(c2[i:i + 2], 16) for i in (1, 3, 5)]
    return '#%02x%02x%02x' % tuple(int(a[i] + (b[i] - a[i]) * f) for i in range(3))


def pcolor(p):
    """Culoarea lichidului în funcție de presiune (0…140 bar)."""
    f = p / 140.0
    if f < 0.5:
        return lerp_color('#cfe0f2', '#f5b041', f / 0.5)
    return lerp_color('#f5b041', '#b03a2e', (f - 0.5) / 0.5)


class App:
    SPEEDS = {'0,02× (cu încetinitorul)': 0.02, '0,05×': 0.05, '0,1×': 0.1,
              '0,25×': 0.25, '0,5×': 0.5, '1× (timp real)': 1.0}

    def __init__(self, root):
        self.root = root
        root.title('Simulator modulator hidraulic ABS – supape electromagnetice 2/2')
        root.configure(bg=BG)
        root.geometry('1400x900')
        root.minsize(1200, 760)
        self.sim = Simulator(MODE_ABS, 'Asfalt uscat', 80)
        self.running = False
        self.wheel_angle = 0.0
        self.flow_phase = {'in': 0.0, 'out': 0.0, 'pump': 0.0}
        self.results = []
        self.viewer = None
        self._carry = 0.0
        self._build_ui()
        self._bind_keys()
        self.on_mode()
        self.draw()
        self.root.after(33, self.loop)

    # ------------------------------------------------------------------ UI
    def _build_ui(self):
        st = ttk.Style()
        try:
            st.theme_use('clam')
        except tk.TclError:
            pass
        st.configure('.', background=BG, font=('Segoe UI', 10))
        st.configure('TLabelframe', background=BG)
        st.configure('TLabelframe.Label', background=BG, font=('Segoe UI', 10, 'bold'))
        st.configure('Big.TButton', font=('Segoe UI', 10, 'bold'))

        top = ttk.Frame(self.root, padding=(10, 8))
        top.pack(side='top', fill='x')

        bf = ttk.Frame(top)
        bf.pack(side='left', padx=(0, 10))
        self._bf = bf
        mf = ttk.Labelframe(top, text='Mod de lucru', padding=(8, 2))
        mf.pack(side='left', padx=(0, 8))
        self.mode_var = tk.StringVar(value=MODE_ABS)
        for txt, val in (('Manual', MODE_MANUAL),
                         ('ABS automat', MODE_ABS),
                         ('Fără ABS', MODE_NOABS)):
            ttk.Radiobutton(mf, text=txt, value=val, variable=self.mode_var,
                            command=self.on_mode).pack(side='left', padx=4)

        sf = ttk.Labelframe(top, text='Drum și vehicul', padding=(8, 2))
        sf.pack(side='left', padx=8)
        ttk.Label(sf, text='Suprafață:').pack(side='left')
        self.scen_var = tk.StringVar(value='Asfalt uscat')
        cb = ttk.Combobox(sf, textvariable=self.scen_var, values=list(SCENARIOS),
                          state='readonly', width=20)
        cb.pack(side='left', padx=4)
        cb.bind('<<ComboboxSelected>>', lambda e: self.reset())
        ttk.Label(sf, text='  v₀ [km/h]:').pack(side='left')
        self.v0_var = tk.IntVar(value=80)
        sp = ttk.Spinbox(sf, from_=20, to=150, increment=10, textvariable=self.v0_var,
                         width=5, command=self.reset)
        sp.pack(side='left', padx=4)

        tf = ttk.Labelframe(top, text='Timp', padding=(8, 2))
        tf.pack(side='left', padx=8)
        ttk.Label(tf, text='Viteză:').pack(side='left')
        self.speed_var = tk.StringVar(value='0,05×')
        ttk.Combobox(tf, textvariable=self.speed_var, values=list(self.SPEEDS),
                     state='readonly', width=15).pack(side='left', padx=4)

        self.btn_run = ttk.Button(bf, text='▶  Start', style='Big.TButton', command=self.toggle_run, width=10)
        self.btn_run.pack(side='left', padx=3)
        ttk.Button(bf, text='⏭ 5 ms', command=self.single_step).pack(side='left', padx=3)
        ttk.Button(bf, text='⟲  Reset', command=self.reset).pack(side='left', padx=3)
        ttk.Button(bf, text='🧊  Vedere 3D', style='Big.TButton', command=self.open_3d).pack(side='left', padx=3)

        body = ttk.Frame(self.root, padding=(10, 0, 10, 8))
        body.pack(fill='both', expand=True)
        left = ttk.Frame(body)
        left.pack(side='left', fill='y')
        right = ttk.Frame(body)
        right.pack(side='left', fill='both', expand=True, padx=(10, 0))

        self.cv = tk.Canvas(left, width=660, height=520, bg='white', highlightthickness=1,
                            highlightbackground='#d0d4da')
        self.cv.pack(side='top')

        # panou fază
        ph = tk.Frame(left, bg='white', highlightthickness=1, highlightbackground='#d0d4da')
        ph.pack(side='top', fill='x', pady=(8, 0))
        self.lbl_phase = tk.Label(ph, text='', font=('Segoe UI', 15, 'bold'), bg='white', anchor='w')
        self.lbl_phase.pack(fill='x', padx=10, pady=(6, 0))
        self.lbl_expl = tk.Label(ph, text='', font=('Segoe UI', 10), bg='white', fg=INK,
                                 justify='left', anchor='w', wraplength=630)
        self.lbl_expl.pack(fill='x', padx=10)
        self.lbl_ecu = tk.Label(ph, text='', font=('Segoe UI', 10, 'italic'), bg='white', fg=MUTED,
                                anchor='w', justify='left', wraplength=630)
        self.lbl_ecu.pack(fill='x', padx=10, pady=(2, 6))

        # comenzi manuale
        self.manual = ttk.Labelframe(left, text='Comenzi manuale (mod Manual)', padding=(8, 4))
        self.manual.pack(side='top', fill='x', pady=(8, 0))
        r1 = ttk.Frame(self.manual)
        r1.pack(fill='x')
        ttk.Label(r1, text='Pedală (3):').pack(side='left')
        self.pedal_var = tk.DoubleVar(value=0.0)
        self.pedal_scale = ttk.Scale(r1, from_=0, to=100, variable=self.pedal_var, length=140,
                                     command=lambda v: self._set_pedal())
        self.pedal_scale.pack(side='left', padx=6)
        self.lbl_pedal = ttk.Label(r1, text='0 %', width=6)
        self.lbl_pedal.pack(side='left')
        r2 = ttk.Frame(self.manual)
        r2.pack(fill='x', pady=(6, 0))
        self.b_build = ttk.Button(r2, text='[1] Creștere', command=lambda: self.set_combo('build'))
        self.b_hold = ttk.Button(r2, text='[2] Menținere', command=lambda: self.set_combo('hold'))
        self.b_dump = ttk.Button(r2, text='[3] Scădere', command=lambda: self.set_combo('dump'))
        for b in (self.b_build, self.b_hold, self.b_dump):
            b.pack(side='left', padx=(0, 6))
        self.v7 = tk.BooleanVar()
        self.v8 = tk.BooleanVar()
        self.v6 = tk.BooleanVar()
        self.c7 = ttk.Checkbutton(r2, text='Bobina 7', variable=self.v7, command=self._manual_valves)
        self.c8 = ttk.Checkbutton(r2, text='Bobina 8', variable=self.v8, command=self._manual_valves)
        self.c6 = ttk.Checkbutton(r2, text='Pompa 6', variable=self.v6, command=self._manual_valves)
        for c in (self.c7, self.c8, self.c6):
            c.pack(side='left', padx=4)
        r3 = r1
        self.hold_var = tk.BooleanVar(value=True)
        self.c_hold = ttk.Checkbutton(r3, text='Stand cu role (v = const.)', variable=self.hold_var,
                                      command=self._set_hold)
        self.c_hold.pack(side='left', padx=(12, 0))
        self.b_restore = ttk.Button(r3, text='[V] ↻ înapoi la v₀', command=self.restore_speed)
        self.b_restore.pack(side='left', padx=6)

        # grafice
        self.pv = tk.Canvas(right, bg='white', highlightthickness=1, highlightbackground='#d0d4da')
        self.pv.pack(fill='both', expand=True)
        self.pv.bind('<Configure>', lambda e: self.draw_plots())
        bot = ttk.Frame(right)
        bot.pack(fill='x', pady=(8, 0))
        self.lbl_res = tk.Label(bot, text='', font=('Consolas', 10), bg=BG, fg=INK, justify='left', anchor='w')
        self.lbl_res.pack(side='left', fill='x')

    def _bind_keys(self):
        self.root.bind('<space>', lambda e: self.toggle_run())
        self.root.bind('1', lambda e: self.set_combo('build'))
        self.root.bind('2', lambda e: self.set_combo('hold'))
        self.root.bind('3', lambda e: self.set_combo('dump'))
        self.root.bind('<Up>', lambda e: self._nudge_pedal(10))
        self.root.bind('<Down>', lambda e: self._nudge_pedal(-10))
        self.root.bind('r', lambda e: self.reset())
        self.root.bind('v', lambda e: self.restore_speed())

    # ------------------------------------------------------------------ acțiuni
    def on_mode(self):
        mode = self.mode_var.get()
        self.sim.mode = mode
        state = 'normal' if mode == MODE_MANUAL else 'disabled'
        for w in (self.b_build, self.b_hold, self.b_dump, self.c7, self.c8, self.c6, self.pedal_scale,
                  self.c_hold, self.b_restore):
            w.state(['!disabled'] if state == 'normal' else ['disabled'])
        self.reset()

    def reset(self):
        self.running = False
        self.btn_run.config(text='▶  Start')
        self.sim = Simulator(self.mode_var.get(), self.scen_var.get(), float(self.v0_var.get()))
        if self.mode_var.get() == MODE_MANUAL:
            self.sim.v = self.sim.v0
            self.sim.hold_speed = self.hold_var.get()
            self._manual_valves()
            self._set_pedal()
        self.draw()

    def toggle_run(self):
        self.running = not self.running
        self.btn_run.config(text='⏸  Pauză' if self.running else '▶  Start')

    def single_step(self):
        self.running = False
        self.btn_run.config(text='▶  Start')
        self.advance(0.005)
        self.draw()

    def _set_pedal(self):
        v = self.pedal_var.get()
        self.lbl_pedal.config(text=f'{v:.0f} %')
        self.sim.manual_pedal = v / 100.0

    def _nudge_pedal(self, d):
        if self.mode_var.get() != MODE_MANUAL:
            return
        self.pedal_var.set(min(max(self.pedal_var.get() + d, 0), 100))
        self._set_pedal()

    def _set_hold(self):
        self.sim.hold_speed = self.hold_var.get()

    def restore_speed(self):
        if self.mode_var.get() != MODE_MANUAL:
            return
        self.sim.restore_speed()
        self.draw()

    def _manual_valves(self):
        if self.mode_var.get() != MODE_MANUAL:
            return
        self.sim.in_energized = self.v7.get()
        self.sim.out_energized = self.v8.get()
        self.sim.pump_on = self.v6.get()

    def set_combo(self, which):
        if self.mode_var.get() != MODE_MANUAL:
            return
        e7, e8, e6 = {'build': (False, False, self.v6.get()),
                      'hold': (True, False, self.v6.get()),
                      'dump': (True, True, True)}[which]
        self.v7.set(e7)
        self.v8.set(e8)
        self.v6.set(e6)
        self._manual_valves()
        self.draw()

    # ------------------------------------------------------------------ bucla
    def advance(self, sim_seconds):
        s = self.sim
        was_stopped = s.stopped
        self._carry += sim_seconds
        n = int(self._carry / s.dt)
        self._carry -= n * s.dt
        for _ in range(n):
            s.step()
        # animație
        vis = sim_seconds
        self.wheel_angle = (self.wheel_angle + s.omega * vis) % (2 * math.pi)
        self.flow_phase['in'] += s.q_in * vis * 1.2
        self.flow_phase['out'] += s.q_out * vis * 1.2
        self.flow_phase['pump'] += s.q_pump * vis * 1.2
        if s.stopped and not was_stopped and s.mode != MODE_MANUAL:
            t_stop = s.t_stop
            name = {MODE_ABS: 'ABS automat', MODE_NOABS: 'Fără ABS'}[s.mode]
            self.results.insert(0, f'{name:12s} | {s.scenario:26s} | {s.v0 * 3.6:4.0f} km/h → '
                                   f'oprire în {fmt(s.x)} m, {fmt(t_stop - s.t_brake, 2)} s')
            self.results = self.results[:5]

    def loop(self):
        if self.running:
            self.advance(0.033 * self.SPEEDS[self.speed_var.get()])
            if self.sim.stopped and self.sim.mode != MODE_MANUAL and self.sim.t > self._stop_t() + 0.3:
                self.toggle_run()
            self.draw()
        self.root.after(33, self.loop)

    def _stop_t(self):
        for r in reversed(self.sim.hist):
            if r[1] > 0:
                return r[0]
        return 0.0

    # ------------------------------------------------------------------ desen
    def draw(self):
        self.draw_schematic()
        self.draw_plots()
        self.update_texts()
        if self.viewer is not None:
            self.viewer.render()

    def open_3d(self):
        if self.viewer is not None:
            self.viewer.win.lift()
            return
        try:
            V = Viewer3D
        except NameError:          # rulare din module separate (dezvoltare)
            from abs_3d import Viewer3D as V
        self.viewer = V(self)
        self.viewer.render()

    def hyd_phase(self):
        i_open, o_open = self.sim.valve_states()
        if i_open and not o_open:
            return 'build'
        if not i_open and not o_open:
            return 'hold'
        if not i_open and o_open:
            return 'dump'
        return 'both'

    def update_texts(self):
        s = self.sim
        key = self.hyd_phase()
        title, col, expl = PHASE_INFO[key]
        self.lbl_phase.config(text=title, fg=col)
        self.lbl_expl.config(text=expl)
        if s.mode == MODE_ABS:
            ecu = 'ECU: ' + (STATE_NAMES[s.state] if s.abs_active else 'ABS inactiv – frânare convențională')
        elif s.mode == MODE_NOABS:
            ecu = 'ECU dezactivat – supapele rămân în poziția de repaus (frânare convențională)'
        else:
            ecu = 'Taste: 1/2/3 = creștere/menținere/scădere · ↑/↓ = pedală · V = înapoi la v₀ · spațiu = start'
        self.lbl_ecu.config(text=ecu)
        hdr = 'Rezultate (ultimele opriri):\n' if self.results else ''
        self.lbl_res.config(text=hdr + '\n'.join(self.results))

    # ---- schema hidraulică
    def draw_schematic(self):
        c = self.cv
        c.delete('all')
        s = self.sim
        i_open, o_open = s.valve_states()
        p_acc = s.V_acc / s.C_acc
        c.create_text(12, 12, text='Principiul modulatorului hidraulic cu supape 2/2', anchor='nw',
                      font=('Segoe UI', 11, 'bold'), fill=INK)
        # legenda culorilor
        for k in range(50):
            c.create_rectangle(440 + k * 3, 16, 443 + k * 3, 26, fill=pcolor(k * 140 / 50), outline='')
        c.create_text(436, 21, text='0', anchor='e', font=('Segoe UI', 8), fill=MUTED)
        c.create_text(594, 21, text='140 bar', anchor='w', font=('Segoe UI', 8), fill=MUTED)

        W = 8
        col_mc, col_w, col_a = pcolor(s.p_mc), pcolor(s.p_w), pcolor(p_acc)
        P = self.PTS
        for key, col in (('mc', col_mc), ('in_up', col_mc), ('pump_up', col_mc), ('pump_mid', col_mc),
                         ('w', col_w), ('w_br', col_w), ('out_down', col_w),
                         ('acc', col_a), ('acc_pump', col_a)):
            c.create_line(*sum(P[key], ()), fill=col, width=W, capstyle='round', joinstyle='round')
        for (x, y) in ((380, 120), (290, 120), (380, 300)):
            c.create_oval(x - 6, y - 6, x + 6, y + 6, fill=INK, outline='')

        # pedală (3) + servofrână (2) + cilindru principal (1)
        ang = math.radians(75 - 35 * s.pedal)
        px, py = 40, 215
        ex, ey = px + 95 * math.cos(ang), py - 95 * math.sin(ang)
        c.create_line(px, py, ex, ey, width=6, fill='#34495e', capstyle='round')
        c.create_rectangle(ex - 14, ey - 4, ex + 14, ey + 6, fill='#34495e', outline='')
        c.create_oval(px - 6, py - 6, px + 6, py + 6, fill='#34495e', outline='')
        rx, ry = px + 55 * math.cos(ang), py - 55 * math.sin(ang)
        c.create_line(rx, ry, 82, 120, width=3, fill='#34495e')
        c.create_text(px + 14, py + 4, text='3', font=('Segoe UI', 11, 'bold'), fill=C_VF, anchor='w')
        c.create_oval(82, 86, 150, 154, fill='#e5e8ec', outline='#7f8c8d', width=2)
        c.create_text(116, 120, text='2', font=('Segoe UI', 12, 'bold'), fill=C_VF)
        c.create_rectangle(150, 102, 230, 138, fill=col_mc, outline='#566573', width=2)
        c.create_rectangle(168, 68, 213, 102, fill='#d6eaf8', outline='#566573', width=2)
        c.create_text(190, 84, text='1', font=('Segoe UI', 12, 'bold'), fill=C_VF)
        c.create_text(190, 152, text=f'p CP = {fmt(s.p_mc, 0)} bar', font=('Segoe UI', 9), fill=INK)
        c.create_text(70, 234, text=f'pedală {s.pedal * 100:.0f} %', font=('Segoe UI', 9), fill=MUTED, anchor='w')
        if s.q_pump > 0.05 and not i_open:
            c.create_text(70, 252, text='↯ pulsație în pedală', font=('Segoe UI', 9, 'bold'), fill='#c0392b', anchor='w')

        # cameră de amortizare (5)
        c.create_rectangle(270, 190, 310, 240, fill=col_mc, outline='#566573', width=2)
        c.create_text(262, 215, text='5', font=('Segoe UI', 11, 'bold'), fill=C_VF, anchor='e')

        # pompă de retur (6)
        on = s.pump_on
        c.create_oval(268, 308, 312, 352, fill=C_ON if on and s.q_pump > 0 else ('#fdebd0' if on else '#eceff1'),
                      outline='#566573', width=2)
        c.create_polygon(290, 316, 280, 340, 300, 340, fill='#566573')
        c.create_text(318, 322, text='6', font=('Segoe UI', 11, 'bold'), fill=C_VF, anchor='w')
        c.create_text(318, 340, text='pompă\n' + ('PORNITĂ' if on else 'oprită'), anchor='nw',
                      font=('Segoe UI', 8, 'bold' if on else 'normal'), fill=INK)

        # acumulator (9)
        c.create_rectangle(355, 450, 405, 500, fill='white', outline='#566573', width=2)
        h = 48 * s.V_acc / s.V_acc_max
        if h > 0.5:
            c.create_rectangle(357, 498 - h, 403, 498, fill=col_a, outline='')
        c.create_text(412, 462, text='9', font=('Segoe UI', 11, 'bold'), fill=C_VF, anchor='w')
        c.create_text(412, 488, text=f'{fmt(s.V_acc, 2)} cm³', font=('Segoe UI', 8), fill=INK, anchor='w')

        # supape
        self._valve(380, 200, '7', 'Supapă admisie (NA) + sens', s.in_energized, i_open)
        self._valve(380, 395, '8', 'Supapă evacuare (NÎ)', s.out_energized, o_open)

        # frâna roții (4) și roata
        cx, cy, R = 600, 300, 54
        c.create_oval(cx - R, cy - R, cx + R, cy + R, fill='#2c3e50', outline='')
        c.create_oval(cx - R + 10, cy - R + 10, cx + R - 10, cy + R - 10, fill='#95a5a6', outline='')
        for k in range(5):
            a = self.wheel_angle + k * 2 * math.pi / 5
            c.create_line(cx, cy, cx + (R - 12) * math.cos(a), cy - (R - 12) * math.sin(a),
                          width=4, fill='#5d6d7e')
        c.create_oval(cx - 11, cy - 11, cx + 11, cy + 11, fill='#5d6d7e', outline='')
        c.create_rectangle(534, 282, 556, 318, fill=col_w, outline='#2c3e50', width=2)
        c.create_text(545, 270, text='4', font=('Segoe UI', 11, 'bold'), fill=C_VF)
        c.create_text(cx, cy + R + 12, text=f'p roată = {fmt(s.p_w, 0)} bar', font=('Segoe UI', 9, 'bold'), fill=C_PW)

        # bloc de valori
        x0, y0 = 470, 438
        lines = [
            (f'v vehicul = {fmt(s.v * 3.6)} km/h', C_VF),
            (f'v roată   = {fmt(s.omega * s.r * 3.6)} km/h', C_VR),
            (f'λ = {fmt(s.lam * 100, 0)} %    μ = {fmt(s.mu, 2)}', INK),
            (f't = {fmt(s.t, 3)} s    x = {fmt(s.x)} m', MUTED),
        ]
        for k, (txt, col) in enumerate(lines):
            c.create_text(x0, y0 + k * 15, text=txt, anchor='nw', font=('Segoe UI', 9), fill=col)
        if s.lam > 0.9 and s.v > 0.5:
            c.create_text(cx - 8, 224, text='ROATĂ BLOCATĂ\n→ nedirecționabil', justify='center',
                          font=('Segoe UI', 9, 'bold'), fill='#c0392b')
        elif s.lam > 0.35 and s.v > 0.5:
            c.create_text(cx - 8, 224, text='alunecare mare\n→ direcționare redusă', justify='center',
                          font=('Segoe UI', 9, 'bold'), fill='#d68910')
        elif s.v > 0.5:
            c.create_text(cx - 8, 224, text='roata se rotește\n→ direcționabil', justify='center',
                          font=('Segoe UI', 9), fill='#2e8b57')
        else:
            c.create_text(cx - 8, 224, text='vehicul oprit', font=('Segoe UI', 9), fill=MUTED)

        # bulinele de debit
        self._flow(P['flow_in'], s.q_in, self.flow_phase['in'])
        self._flow(P['flow_out'], s.q_out, self.flow_phase['out'])
        self._flow(P['flow_pump'], s.q_pump, self.flow_phase['pump'])

        # curba μ–λ
        self._mu_plot(14, 278, 236, 222)
        c.create_text(14, 508, anchor='w', font=('Segoe UI', 7), fill=MUTED,
                      text='NA = normal deschisă · NÎ = normal închisă · „+ sens” = supapă de sens montată în paralel cu 7')

    PTS = {
        'mc': [(230, 120), (380, 120)],
        'in_up': [(380, 120), (380, 170)],
        'pump_up': [(290, 120), (290, 190)],
        'pump_mid': [(290, 240), (290, 308)],
        'w': [(380, 230), (380, 300)],
        'w_br': [(380, 300), (534, 300)],
        'out_down': [(380, 300), (380, 365)],
        'acc': [(380, 425), (380, 450)],
        'acc_pump': [(355, 475), (290, 475), (290, 352)],
        'flow_in': [(230, 120), (380, 120), (380, 170), (380, 230), (380, 300), (534, 300)],
        'flow_out': [(534, 300), (380, 300), (380, 365), (380, 425), (380, 455)],
        'flow_pump': [(355, 475), (290, 475), (290, 352), (290, 308), (290, 240), (290, 190), (290, 120)],
    }

    def _valve(self, x, y, num, label, energized, is_open):
        c = self.cv
        w, h = 46, 60
        c.create_rectangle(x - w / 2, y - h / 2, x + w / 2, y + h / 2, fill='white', outline=INK, width=2)
        if is_open:
            c.create_line(x, y + h / 2 - 6, x, y - h / 2 + 6, width=3, fill=INK, arrow='both', arrowshape=(8, 10, 4))
        else:
            c.create_line(x, y - h / 2 + 6, x, y - 4, width=3, fill=INK)
            c.create_line(x - 10, y - 4, x + 10, y - 4, width=3, fill=INK)
            c.create_line(x, y + h / 2 - 6, x, y + 4, width=3, fill=INK)
            c.create_line(x - 10, y + 4, x + 10, y + 4, width=3, fill=INK)
        bx = x - w / 2 - 26
        c.create_rectangle(bx, y - 14, bx + 24, y + 14, fill=C_ON if energized else '#eceff1', outline=INK, width=2)
        c.create_line(bx + 4, y + 10, bx + 20, y - 10, width=2, fill=INK)
        c.create_text(bx - 5, y, text=num, font=('Segoe UI', 12, 'bold'), fill=C_VF, anchor='e')
        sx = x + w / 2
        pts = [sx, y]
        for k in range(1, 7):
            pts += [sx + k * 4, y + (8 if k % 2 else -8)]
        pts += [sx + 28, y]
        c.create_line(*pts, width=2, fill=INK)
        tx = x + w / 2 + 36
        c.create_text(tx, y - 16, text=label, anchor='w', font=('Segoe UI', 8), fill=INK)
        c.create_text(tx, y, anchor='w', font=('Segoe UI', 8, 'bold' if energized else 'normal'),
                      text='bobină ' + ('ALIMENTATĂ' if energized else 'nealimentată'),
                      fill='#b9770e' if energized else MUTED)
        c.create_text(tx, y + 16, anchor='w', font=('Segoe UI', 9, 'bold'),
                      text='→ DESCHISĂ' if is_open else '→ ÎNCHISĂ',
                      fill='#2e8b57' if is_open else '#c0392b')

    def _flow(self, pts, q, phase):
        if abs(q) < 0.05:
            return
        segs, total = [], 0.0
        for a, b in zip(pts, pts[1:]):
            L = math.dist(a, b)
            segs.append((a, b, L))
            total += L
        spacing = 22.0
        off = (phase * 40.0) % spacing
        if q < 0:
            off = spacing - off
        d = off
        while d < total:
            dd = d if q > 0 else total - d
            acc = 0.0
            for a, b, L in segs:
                if acc + L >= dd:
                    f = (dd - acc) / L if L else 0
                    x, y = a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f
                    self.cv.create_oval(x - 3, y - 3, x + 3, y + 3, fill='white', outline=INK)
                    break
                acc += L
            d += spacing

    def _mu_plot(self, x0, y0, w, h):
        c, s = self.cv, self.sim
        surf = s.surface()
        c.create_rectangle(x0, y0, x0 + w, y0 + h, outline='#d0d4da')
        c.create_text(x0 + 6, y0 + 4, anchor='nw', text=f'Curba μ–λ ({surf})', font=('Segoe UI', 9, 'bold'), fill=INK)
        l, t, r, b = x0 + 34, y0 + 24, x0 + w - 10, y0 + h - 26
        ymax = 1.3
        c.create_line(l, b, r, b, fill=MUTED)
        c.create_line(l, b, l, t, fill=MUTED)
        for v in (0, 0.5, 1.0):
            yy = b - (b - t) * v / ymax
            c.create_text(l - 4, yy, text=fmt(v), anchor='e', font=('Segoe UI', 7), fill=MUTED)
        for v in (0, 0.25, 0.5, 0.75, 1.0):
            xx = l + (r - l) * v
            c.create_text(xx, b + 8, text=f'{v * 100:.0f}%', font=('Segoe UI', 7), fill=MUTED)
        c.create_text((l + r) / 2, b + 19, text='alunecare λ', font=('Segoe UI', 8), fill=MUTED)
        c.create_text(l - 26, t - 6, text='μ', anchor='w', font=('Segoe UI', 9, 'italic'), fill=MUTED)
        if s.mode == MODE_ABS:
            xx = l + (r - l) * s.lam1
            c.create_line(xx, t, xx, b, fill='#aab7b8', dash=(3, 3))
            c.create_text(xx + 3, t + 2, text='λ1', anchor='nw', font=('Segoe UI', 8), fill=MUTED)
        pts = []
        for i in range(101):
            lam = i / 100
            pts += [l + (r - l) * lam, b - (b - t) * mu_of(surf, lam) / ymax]
        c.create_line(*pts, fill=C_VF, width=2, smooth=True)
        lp, mp = mu_peak(surf)
        c.create_text(r, t - 4, text=f'μmax = {fmt(mp, 2)} la λ = {lp * 100:.0f} %',
                      anchor='ne', font=('Segoe UI', 7), fill=C_VF)
        c.create_line(l + (r - l) * lp, b - (b - t) * mp / ymax, l + (r - l) * lp, b, fill=C_VF, dash=(1, 3))
        xx, yy = l + (r - l) * s.lam, b - (b - t) * s.mu / ymax
        c.create_oval(xx - 6, yy - 6, xx + 6, yy + 6, fill=C_VR, outline='white', width=2)

    # ---- grafice în timp
    def draw_plots(self):
        c = self.pv
        c.delete('all')
        W = max(c.winfo_width(), 600)
        H = max(c.winfo_height(), 600)
        s = self.sim
        hist = s.hist
        span = 3.0 if s.mode != MODE_MANUAL else 6.0
        t_end = max(s.t, span)
        t0 = t_end - span
        data = [r for r in hist if r[0] >= t0]
        if len(data) > 700:
            step = len(data) // 700 + 1
            data = data[::step] + [data[-1]]
        L, R = 84, W - 18
        top = 10
        panels = [
            ('Viteze [km/h]', 0, max(s.v0 * 3.6 * 1.05, 10),
             [(1, C_VF, 'v vehicul'), (2, C_VR, 'v roată'), (3, C_REF, 'v referință ECU')], None),
            ('Presiune [bar]', 0, 150, [(5, C_PMC, 'p cilindru principal'), (4, C_PW, 'p roată')], None),
            ('Accelerație roată [m/s²]', -80, 60, [(7, '#8e44ad', 'a roată')],
             [(s.th_neg_a, '−a'), (s.th_pos_a, '+a'), (s.th_pos_A, '+A')]),
            ('Alunecare λ [%]', 0, 100, [(11, '#aab7b8', 'λ calculat de ECU (din v ref)'), (6, '#16a085', 'λ real')],
             [(s.lam1 * 100, 'λ1')]),
        ]
        valve_h = 70
        ph = (H - top - valve_h - 34) / len(panels)
        X = lambda t: L + (R - L) * (t - t0) / span
        for k, (title, ymin, ymax, series, thr) in enumerate(panels):
            y0 = top + k * ph
            y1 = y0 + ph - 18
            Y = lambda v, y0=y0, y1=y1, ymin=ymin, ymax=ymax: y1 - (y1 - y0) * (min(max(v, ymin), ymax) - ymin) / (ymax - ymin)
            c.create_rectangle(L, y0, R, y1, outline='#d0d4da')
            c.create_text(L + 6, y0 + 4, text=title, anchor='nw', font=('Segoe UI', 9, 'bold'), fill=INK)
            for frac in (0, 0.5, 1):
                v = ymin + (ymax - ymin) * frac
                c.create_text(L - 6, Y(v), text=f'{v:.0f}', anchor='e', font=('Segoe UI', 8), fill=MUTED)
                if 0 < frac < 1:
                    c.create_line(L, Y(v), R, Y(v), fill='#eef0f3')
            if ymin < 0 < ymax:
                c.create_line(L, Y(0), R, Y(0), fill='#cfd4da')
            if thr and (s.mode == MODE_ABS):
                for v, lab in thr:
                    c.create_line(L, Y(v), R, Y(v), fill='#aab7b8', dash=(4, 3))
                    c.create_text(R - 4, Y(v) - 2, text=lab, anchor='se', font=('Segoe UI', 8), fill=MUTED)
            lx = R - 8
            for idx, col, name in reversed(series):
                c.create_text(lx, y0 + 4, text=name, anchor='ne', font=('Segoe UI', 8), fill=col)
                lx -= 7 * len(name) + 14
                if len(data) > 1:
                    pts = []
                    for r_ in data:
                        v = r_[idx] * (100 if idx in (6, 11) else 1)
                        pts += [X(r_[0]), Y(v)]
                    c.create_line(*pts, fill=col, width=2)
        # stări supape
        y0 = top + len(panels) * ph
        c.create_text(L + 6, y0, text='Stare bobine (portocaliu = alimentată)', anchor='nw',
                      font=('Segoe UI', 9, 'bold'), fill=INK)
        rows = [('7 admisie', 9), ('8 evacuare', 10)]
        for j, (lab, idx) in enumerate(rows):
            yy = y0 + 22 + j * 22
            c.create_text(L - 6, yy + 8, text=lab, anchor='e', font=('Segoe UI', 8), fill=INK)
            c.create_rectangle(L, yy, R, yy + 16, fill='#f4f6f7', outline='#d0d4da')
            run_start = None
            for a, b in zip(data, data[1:] + [None]):
                energized = (not a[9]) if idx == 9 else a[10]
                if energized and run_start is None:
                    run_start = a[0]
                end_run = run_start is not None and (b is None or not ((not b[9]) if idx == 9 else b[10]))
                if end_run:
                    c.create_rectangle(X(run_start), yy + 1, X(b[0] if b else a[0]), yy + 15, fill=C_ON, outline='')
                    run_start = None
        # axa timpului
        yb = y0 + 70
        for k in range(int(span) + 1):
            tt = math.floor(t0) + k
            if t0 <= tt <= t_end:
                c.create_text(X(tt), yb + 4, text=f'{tt:.0f} s', font=('Segoe UI', 8), fill=MUTED, anchor='n')



# ======================================================================
#  Vizualizare 3D (motor de randare simplu pe tkinter.Canvas)
# ======================================================================


def v_add(a, b): return (a[0] + b[0], a[1] + b[1], a[2] + b[2])
def v_sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def v_mul(a, k): return (a[0] * k, a[1] * k, a[2] * k)
def v_dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def v_cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def v_norm(a):
    L = math.sqrt(v_dot(a, a)) or 1.0
    return (a[0] / L, a[1] / L, a[2] / L)


def shade(col, f):
    f = min(max(f, 0.0), 1.25)
    rgb = [int(col[i:i + 2], 16) for i in (1, 3, 5)]
    if f <= 1.0:
        rgb = [int(c * f) for c in rgb]
    else:
        rgb = [int(c + (255 - c) * (f - 1.0)) for c in rgb]
    return '#%02x%02x%02x' % tuple(min(max(c, 0), 255) for c in rgb)


class Scene:
    """Colectează fețe (poligoane) și segmente (conducte, fire) pentru un cadru."""

    def __init__(self):
        self.faces = []    # (pts, color, normal, outline)
        self.lines = []    # (p0, p1, color, width_world)
        self.dots = []     # (p, color, r_world)
        self.labels = []   # (anchor, text, num)

    def face(self, pts, color, center=None, outline=''):
        n = v_norm(v_cross(v_sub(pts[1], pts[0]), v_sub(pts[2], pts[0])))
        if center is not None:
            c = v_mul(pts[0], 0)
            for p in pts:
                c = v_add(c, p)
            c = v_mul(c, 1.0 / len(pts))
            if v_dot(n, v_sub(c, center)) < 0:
                n = v_mul(n, -1)
        self.faces.append((pts, color, n, outline))

    def box(self, lo, hi, color, outline=''):
        x0, y0, z0 = lo
        x1, y1, z1 = hi
        c = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
        P = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
             (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
        for idx in ((0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (2, 3, 7, 6), (1, 2, 6, 5), (0, 3, 7, 4)):
            self.face([P[i] for i in idx], color, c, outline)

    def wire_box(self, lo, hi, color, width=0.4):
        x0, y0, z0 = lo
        x1, y1, z1 = hi
        P = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
             (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
        for a, b in ((0, 1), (1, 2), (2, 3), (3, 0), (4, 5), (5, 6), (6, 7), (7, 4), (0, 4), (1, 5), (2, 6), (3, 7)):
            self.line(P[a], P[b], color, width, split=4)

    def cylinder(self, p0, p1, r, color, n=16, caps=True, cap_color=None, r1=None, phase=0.0):
        r1 = r if r1 is None else r1
        d = v_norm(v_sub(p1, p0))
        u = v_norm(v_cross(d, (0, 1, 0) if abs(d[1]) < 0.9 else (1, 0, 0)))
        w = v_cross(d, u)
        c = v_mul(v_add(p0, p1), 0.5)
        ring0, ring1 = [], []
        for i in range(n):
            a = phase + 2 * math.pi * i / n
            off = v_add(v_mul(u, math.cos(a)), v_mul(w, math.sin(a)))
            ring0.append(v_add(p0, v_mul(off, r)))
            ring1.append(v_add(p1, v_mul(off, r1)))
        for i in range(n):
            j = (i + 1) % n
            self.face([ring0[i], ring0[j], ring1[j], ring1[i]], color, c)
        if caps:
            self.face(ring0[::-1], cap_color or color, c)
            self.face(ring1, cap_color or color, c)
        return u, w

    def annulus(self, center, axis, r_in, r_out, color, n=24, phase=0.0, solid_center=None):
        d = v_norm(axis)
        u = v_norm(v_cross(d, (0, 1, 0) if abs(d[1]) < 0.9 else (1, 0, 0)))
        w = v_cross(d, u)
        sc = solid_center or v_sub(center, d)
        for i in range(n):
            a0 = phase + 2 * math.pi * i / n
            a1 = phase + 2 * math.pi * (i + 1) / n
            pts = []
            for a, r in ((a0, r_in), (a1, r_in), (a1, r_out), (a0, r_out)):
                pts.append(v_add(center, v_add(v_mul(u, r * math.cos(a)), v_mul(w, r * math.sin(a)))))
            self.face(pts, color, sc)

    def line(self, p0, p1, color, width, split=1):
        for k in range(split):
            a = v_add(p0, v_mul(v_sub(p1, p0), k / split))
            b = v_add(p0, v_mul(v_sub(p1, p0), (k + 1) / split))
            self.lines.append((a, b, color, width))

    def pipe(self, pts, color, width=1.6):
        for a, b in zip(pts, pts[1:]):
            L = math.dist(a, b)
            self.line(a, b, color, width, split=max(1, int(L / 4)))

    def flow(self, pts, q, phase, color='#ffffff'):
        if abs(q) < 0.05:
            return
        segs, total = [], 0.0
        for a, b in zip(pts, pts[1:]):
            L = math.dist(a, b)
            segs.append((a, b, L))
            total += L
        spacing = 5.0
        off = (phase * 12.0) % spacing
        d = off if q > 0 else spacing - off
        while d < total:
            dd = d if q > 0 else total - d
            acc = 0.0
            for a, b, L in segs:
                if acc + L >= dd:
                    f = (dd - acc) / L if L else 0
                    self.dots.append((v_add(a, v_mul(v_sub(b, a), f)), color, 0.9))
                    break
                acc += L
            d += spacing

    def label(self, anchor, text, num=''):
        self.labels.append((anchor, text, num))


class Viewer3D:
    VIEWS = {
        'Ansamblu': ((18, 28, 0), 0.3, 0.35, 210),
        'Modulator (HCU)': ((27, 24, 2), 0.55, 0.35, 105),
        'Pedală + cilindru principal': ((-62, 48, 0), -0.75, 0.25, 95),
        'Roată + senzor': ((100, 22, 4), 0.35, 0.22, 150),
    }

    def __init__(self, app):
        self.app = app
        self.win = tk.Toplevel(app.root)
        self.win.title('Vizualizare 3D – modulator hidraulic ABS')
        self.win.geometry('1180x760')
        self.win.configure(bg=BG)
        self.win.protocol('WM_DELETE_WINDOW', self.close)
        self.target, self.yaw, self.pitch, self.dist = self.VIEWS['Ansamblu']
        self.f = 900.0
        self._drag = None
        self.goal = None

        side = ttk.Frame(self.win, padding=10)
        side.pack(side='right', fill='y')
        self.cv = tk.Canvas(self.win, bg='#eef1f5', highlightthickness=0)
        self.cv.pack(side='left', fill='both', expand=True)

        ttk.Label(side, text='Vederi', font=('Segoe UI', 10, 'bold')).pack(anchor='w')
        for name in self.VIEWS:
            ttk.Button(side, text=name, command=lambda n=name: self.set_view(n)).pack(fill='x', pady=2)
        ttk.Separator(side).pack(fill='x', pady=8)
        self.transp = tk.BooleanVar(value=True)
        self.show_labels = tk.BooleanVar(value=True)
        self.auto_rot = tk.BooleanVar(value=False)
        ttk.Checkbutton(side, text='Bloc HCU transparent\n(se văd canalele și supapele)', variable=self.transp,
                        command=self.render).pack(anchor='w', pady=2)
        ttk.Checkbutton(side, text='Etichete', variable=self.show_labels, command=self.render).pack(anchor='w', pady=2)
        ttk.Checkbutton(side, text='Rotire automată', variable=self.auto_rot).pack(anchor='w', pady=2)
        ttk.Separator(side).pack(fill='x', pady=8)
        legend = (
            'Mouse:\n'
            '  stânga + tragere – rotire\n'
            '  dreapta + tragere – deplasare\n'
            '  rotița – zoom\n\n'
            'Culori:\n'
            '  lichid: albastru deschis → roșu\n'
            '  = presiune 0 → 140 bar\n'
            '  bobină portocalie = alimentată\n'
            '  buline albe = curgerea lichidului\n\n'
            'Supapa 7 (admisie) este normal\n'
            'deschisă: alimentată, pistonul\n'
            'coboară și închide scaunul.\n\n'
            'Supapa 8 (evacuare) este normal\n'
            'închisă: alimentată, pistonul\n'
            'se ridică și deschide drumul\n'
            'spre acumulatorul 9.\n\n'
            'Simularea se comandă din\n'
            'fereastra principală.')
        tk.Label(side, text=legend, justify='left', bg=BG, fg=INK, font=('Segoe UI', 9)).pack(anchor='w')

        self.cv.bind('<ButtonPress-1>', lambda e: self._press(e, 'rot'))
        self.cv.bind('<ButtonPress-3>', lambda e: self._press(e, 'pan'))
        self.cv.bind('<B1-Motion>', self._motion)
        self.cv.bind('<B3-Motion>', self._motion)
        self.cv.bind('<MouseWheel>', lambda e: self._zoom(-1 if e.delta > 0 else 1))
        self.cv.bind('<Button-4>', lambda e: self._zoom(-1))
        self.cv.bind('<Button-5>', lambda e: self._zoom(1))
        self.cv.bind('<Configure>', lambda e: self.render())
        self._tick()

    # ------------------------------------------------------------------ interacțiune
    def close(self):
        self.app.viewer = None
        self.win.destroy()

    def set_view(self, name):
        self.goal = self.VIEWS[name]

    def _press(self, e, kind):
        self._drag = (kind, e.x, e.y)
        self.goal = None

    def _motion(self, e):
        if not self._drag:
            return
        kind, x0, y0 = self._drag
        dx, dy = e.x - x0, e.y - y0
        self._drag = (kind, e.x, e.y)
        if kind == 'rot':
            self.yaw += dx * 0.008
            self.pitch = min(max(self.pitch + dy * 0.008, -1.3), 1.3)
        else:
            k = self.dist / self.f
            cy, sy = math.cos(self.yaw), math.sin(self.yaw)
            right = (cy, 0, -sy)
            self.target = v_add(self.target, v_add(v_mul(right, -dx * k), (0, dy * k, 0)))
        self.render()

    def _zoom(self, d):
        self.dist = min(max(self.dist * (1.12 if d > 0 else 1 / 1.12), 50), 900)
        self.render()

    def _tick(self):
        if not self.win.winfo_exists():
            return
        changed = False
        if self.goal:
            t, yw, pt, ds = self.goal
            a = 0.18
            self.target = v_add(self.target, v_mul(v_sub(t, self.target), a))
            self.yaw += (yw - self.yaw) * a
            self.pitch += (pt - self.pitch) * a
            self.dist += (ds - self.dist) * a
            if abs(yw - self.yaw) < 1e-3 and abs(ds - self.dist) < 0.5 and math.dist(t, self.target) < 0.2:
                self.goal = None
            changed = True
        if self.auto_rot.get():
            self.yaw += 0.01
            changed = True
        if changed and not self.app.running:
            self.render()
        self.win.after(33, self._tick)

    # ------------------------------------------------------------------ proiecție
    def _view(self, p):
        x, y, z = v_sub(p, self.target)
        cy, sy = math.cos(self.yaw), math.sin(self.yaw)
        x, z = cy * x - sy * z, sy * x + cy * z
        cp, sp = math.cos(self.pitch), math.sin(self.pitch)
        y, z = cp * y - sp * z, sp * y + cp * z
        return (x, y, -z)      # camera privește spre −z (scena)

    def _rot(self, n):
        x, y, z = n
        cy, sy = math.cos(self.yaw), math.sin(self.yaw)
        x, z = cy * x - sy * z, sy * x + cy * z
        cp, sp = math.cos(self.pitch), math.sin(self.pitch)
        y, z = cp * y - sp * z, sp * y + cp * z
        return (x, y, -z)

    def _proj(self, v):
        depth = self.dist + v[2]
        depth = max(depth, 5.0)
        return (self.cx + self.f * v[0] / depth, self.cy - self.f * v[1] / depth, depth)

    # ------------------------------------------------------------------ scena
    def build(self):
        app, s = self.app, self.app.sim
        S = Scene()
        p_acc = s.V_acc / s.C_acc
        c_mc, c_w, c_a = pcolor(s.p_mc), pcolor(s.p_w), pcolor(p_acc)
        transparent = self.transp.get()
        ALU = '#b8c0c8'

        # --- pedală (3), servofrână (2), cilindru principal + rezervor (1)
        piv = (-92, 70, 0)
        ang = math.radians(8 + 22 * s.pedal)
        pad = (piv[0] + 34 * math.sin(ang), piv[1] - 34 * math.cos(ang), 0)
        S.line(piv, pad, '#34495e', 1.6, split=3)
        S.box(v_add(pad, (-1.2, -1.5, -4)), v_add(pad, (1.2, 1.5, 4)), '#34495e')
        rod_a = v_add(piv, (20 * math.sin(ang), -20 * math.cos(ang), 0))
        S.line(rod_a, (-64, 46, 0), '#7f8c8d', 0.8, split=3)
        S.cylinder((-64, 46, 0), (-50, 46, 0), 13, '#cfd6dd', n=20)
        S.cylinder((-50, 46, 0), (-24, 46, 0), 4.2, c_mc, n=14, cap_color=shade(c_mc, 0.8))
        S.box((-44, 50, -4), (-30, 58, 4), '#cfe6f7')
        S.cylinder((-37, 58, 0), (-37, 61, 0), 2.5, '#2c3e50', n=10)
        S.label((-64, 59, 0), 'Servofrână', '2')
        S.label((-37, 62, 0), 'Cilindru principal + rezervor', '1')
        S.label(pad, 'Pedală de frână', '3')

        # --- conducta CP → HCU
        mc_pipe = [(-24, 46, 0), (-6, 46, 0), (-6, 30, 0), (10, 30, 0)]
        S.pipe(mc_pipe, c_mc)

        # --- blocul hidraulic (HCU)
        lo, hi = (10, 12, -10), (44, 36, 10)
        if transparent:
            S.wire_box(lo, hi, '#8795a1', 0.35)
        else:
            S.box(lo, hi, ALU)
        S.label((27, 12, 10), 'Bloc hidraulic (HCU)', '')
        # ECU atașat pe spate
        S.box((12, 14, -14), (42, 34, -10.5), '#4a6b5a')
        S.label((42, 34, -14), 'ECU (unitate electronică)', '')

        # bobine pe capac (7 și 8)
        e7, e8 = s.in_energized, s.out_energized
        i_open, o_open = s.valve_states()
        for x, en, num, name in ((20, e7, '7', 'Supapă admisie (normal deschisă)'),
                                 (32, e8, '8', 'Supapă evacuare (normal închisă)')):
            S.cylinder((x, 36, 0), (x, 44, 0), 3.4, C_ON if en else '#d5d8dc', n=16,
                       cap_color='#7f8c8d')
            S.label((x, 44, 0), name, num)

        # canale interne (vizibile doar cu HCU transparent)
        ch_a = [(10, 30, 0), (20, 30, 0)]                          # de la CP la supapa 7
        ch_a2 = [(14, 30, 0), (14, 26, 0)]                        # spre camera de amortizare
        ch_b = [(20, 22, 0), (32, 22, 0), (44, 22, 0)]             # de la supapa 7 spre roată
        ch_b2 = [(32, 22, 0), (32, 20, 0)]
        ch_c = [(32, 15, 0), (40, 15, 0), (40, 12, 0)]             # de la supapa 8 la acumulator
        ch_c2 = [(32, 15, 0), (26, 15, 0), (26, 15, 6)]            # spre pompă
        ch_d = [(26, 19, 6), (26, 19, 0), (14, 19, 0), (14, 20, 0)]  # refulare pompă → amortizor
        if transparent:
            for pts, col in ((ch_a, c_mc), (ch_a2, c_mc), (ch_b, c_w), (ch_b2, c_w),
                             (ch_c, c_a), (ch_c2, c_a), (ch_d, c_mc)):
                S.pipe(pts, col, 1.4)
            # supapa 7: corp + scaun + piston
            S.cylinder((20, 22, 0), (20, 30, 0), 2.0, '#dfe4ea', n=12, caps=False)
            S.cylinder((20, 25.6, 0), (20, 26.4, 0), 2.2, '#5d6d7e', n=12)      # scaun
            y_p = 26.6 if not i_open else 29.0
            S.cylinder((20, y_p, 0), (20, y_p + 3.5, 0), 1.3, '#c0392b', n=10)  # piston
            S.line((20, y_p + 3.5, 0), (20, 36, 0), '#5d6d7e', 0.45)
            # supapa 8
            S.cylinder((32, 15, 0), (32, 22, 0), 2.0, '#dfe4ea', n=12, caps=False)
            S.cylinder((32, 17.6, 0), (32, 18.4, 0), 2.2, '#5d6d7e', n=12)
            y_p = 18.6 if not o_open else 21.0
            S.cylinder((32, y_p, 0), (32, y_p + 2.2, 0), 1.3, '#c0392b', n=10)
            S.line((32, y_p + 2.2, 0), (32, 36, 0), '#5d6d7e', 0.45)
            # camera de amortizare (5)
            S.cylinder((14, 20, 0), (14, 26, 0), 2.6, c_mc, n=12)
            S.label((14, 23, -3), 'Cameră de amortizare', '5')
            # elementul pompei
            S.cylinder((26, 15, 6), (26, 19, 6), 1.6, c_a if s.q_pump < 0.05 else c_mc, n=10)
        # acumulator (9) sub bloc
        S.cylinder((40, 12, 0), (40, 4, 0), 4.0, '#dfe4ea' if transparent else ALU, n=16)
        fill = s.V_acc / s.V_acc_max
        if fill > 0.01:
            S.cylinder((40, 11.8, 0), (40, 11.8 - 7.5 * fill, 0), 3.6, c_a, n=14)
        S.label((40, 4, 0), 'Acumulator', '9')
        # motorul pompei (6) pe fața din față
        S.cylinder((26, 19, 10), (26, 19, 22), 6.0, '#34495e', n=18, cap_color='#2c3e50')
        rot = app.wheel_angle * 0.0 + app.flow_phase['pump'] * 3.0
        if s.pump_on:
            for k in range(3):
                a = rot + k * 2 * math.pi / 3
                S.line((26, 19, 22.1), (26 + 5 * math.cos(a), 19 + 5 * math.sin(a), 22.1), C_ON, 0.7)
        S.label((26, 25, 22), 'Pompă de retur (motor)', '6')

        # --- conductă HCU → etrier
        W = (100, 22, 0)
        cal = (100 + 13.5, 22 + 13.5, 8)
        brake_pipe = [(44, 22, 0), (60, 22, 0), (70, 40, 8), (cal[0] - 4, cal[1] + 2, 8)]
        S.pipe(brake_pipe, c_w)

        # --- roata: anvelopă, jantă, disc, etrier, roată dințată + senzor
        wa = app.wheel_angle
        S.cylinder((W[0], W[1], -12), (W[0], W[1], 2), 30, '#2b2b2b', n=28, caps=False, phase=wa)
        S.annulus((W[0], W[1], 2), (0, 0, 1), 21, 30, '#3a3a3a', n=28, phase=wa, solid_center=(W[0], W[1], -5))
        S.annulus((W[0], W[1], -12), (0, 0, -1), 21, 30, '#3a3a3a', n=28, phase=wa, solid_center=(W[0], W[1], -5))
        S.annulus((W[0], W[1], -4), (0, 0, 1), 0.1, 21, '#9aa3ab', n=20, phase=wa, solid_center=(W[0], W[1], -6))
        S.cylinder((W[0], W[1], 4), (W[0], W[1], 6.5), 19, '#9ea7ae', n=28, phase=wa, cap_color='#b3bbc2')
        for k in range(10):
            a = wa + k * 2 * math.pi / 10
            c = (W[0] + 14 * math.cos(a), W[1] + 14 * math.sin(a), 6.55)
            S.cylinder(c, (c[0], c[1], 6.6), 1.0, '#4d565e', n=6)
        S.cylinder((W[0], W[1], 6.5), (W[0], W[1], 10), 7, '#7b8590', n=14, cap_color='#aab3bb')
        # roată dințată (inel de impulsuri)
        for k in range(24):
            a = wa + k * 2 * math.pi / 24
            p0 = (W[0] + 8.0 * math.cos(a), W[1] + 8.0 * math.sin(a), 10.2)
            p1 = (W[0] + 9.6 * math.cos(a), W[1] + 9.6 * math.sin(a), 10.2)
            S.line(p0, p1, '#555f69', 0.9)
        # senzor de turație
        S.cylinder((W[0], W[1] - 18, 10.2), (W[0], W[1] - 10.5, 10.2), 1.4, '#1f5fa8', n=10)
        sensor_wire = [(W[0], W[1] - 18, 10.2), (80, -2, 8), (44, 12, -14)]
        S.pipe(sensor_wire, '#1f5fa8', 0.4)
        S.label((W[0], W[1] - 18, 10.2), 'Senzor de turație + roată dințată', '')
        # etrier (colorat după presiunea din cilindrul de roată)
        ca = math.radians(45)
        cc = (W[0] + 17 * math.cos(ca), W[1] + 17 * math.sin(ca), 5.2)
        S.box(v_add(cc, (-4.5, -4.5, -3.6)), v_add(cc, (4.5, 4.5, 3.6)), shade(c_w, 0.95))
        S.label(v_add(cc, (3, 4, 3)), 'Etrier + disc de frână', '4')

        # --- buline de curgere
        ph = app.flow_phase
        ext_in = mc_pipe + ([] if not transparent else [])
        if transparent:
            path_in = mc_pipe + [(20, 30, 0), (20, 22, 0), (32, 22, 0), (44, 22, 0)] + brake_pipe[1:]
            path_out = brake_pipe[::-1] + [(32, 22, 0), (32, 15, 0), (40, 15, 0), (40, 6, 0)]
            path_pump = [(40, 12, 0), (40, 15, 0), (26, 15, 0), (26, 15, 6), (26, 19, 6), (26, 19, 0),
                         (14, 19, 0), (14, 30, 0), (10, 30, 0)]
            S.flow(path_in, s.q_in, ph['in'])
            S.flow(path_out, s.q_out, ph['out'])
            S.flow(path_pump, s.q_pump, ph['pump'])
        else:
            S.flow(ext_in, s.q_in - s.q_pump, ph['in'])
            S.flow(brake_pipe, s.q_in - s.q_out, ph['in'] - ph['out'])
        return S

    # ------------------------------------------------------------------ randare
    def render(self):
        if not self.win.winfo_exists():
            return
        c = self.cv
        W, H = max(c.winfo_width(), 200), max(c.winfo_height(), 200)
        self.cx, self.cy = W / 2, H / 2 + 20
        c.delete('all')
        S = self.build()
        L = v_norm((-0.45, 0.65, 0.6))
        items = []
        for pts, col, n, outline in S.faces:
            nv = self._rot(n)
            vs = [self._view(p) for p in pts]
            cen = v_mul(vs[0], 0)
            for v in vs:
                cen = v_add(cen, v)
            cen = v_mul(cen, 1.0 / len(vs))
            to_cam = v_sub((0, 0, -self.dist), cen)
            if v_dot(nv, to_cam) <= 0:
                continue
            lam = 0.38 + 0.72 * max(0.0, v_dot(nv, (L[0], L[1], -L[2])))
            pr = [self._proj(v) for v in vs]
            depth = sum(p[2] for p in pr) / len(pr)
            items.append((depth, 'f', [q for p in pr for q in p[:2]], shade(col, lam), outline))
        for a, b, col, wd in S.lines:
            pa, pb = self._proj(self._view(a)), self._proj(self._view(b))
            depth = (pa[2] + pb[2]) / 2 - 0.5
            w = max(1.0, self.f * wd / depth)
            items.append((depth, 'l', (pa[0], pa[1], pb[0], pb[1]), col, w))
        for p, col, r in S.dots:
            pp = self._proj(self._view(p))
            rr = max(1.8, self.f * r / pp[2])
            items.append((pp[2] - 1.0, 'd', (pp[0], pp[1], rr), col, None))
        items.sort(key=lambda it: -it[0])
        for depth, kind, data, col, extra in items:
            if kind == 'f':
                c.create_polygon(*data, fill=col, outline=extra or col)
            elif kind == 'l':
                c.create_line(*data, fill=col, width=extra, capstyle='round')
            else:
                x, y, r = data
                c.create_oval(x - r, y - r, x + r, y + r, fill=col, outline='#1d2433')
        if self.show_labels.get():
            placed = []
            labs = []
            for anchor, text, num in S.labels:
                x, y, d = self._proj(self._view(anchor))
                labs.append((y, x, text, num))
            labs.sort()
            for y, x, text, num in labs:
                t = (num + ' – ' if num else '') + text
                tid = c.create_text(0, 0, text=t, anchor='w', font=('Segoe UI', 9, 'bold' if num else 'normal'),
                                    fill=INK)
                bb = c.bbox(tid)
                w_, h_ = bb[2] - bb[0], bb[3] - bb[1]
                right = x < self.cx + 60
                lx = x + 24 if right else x - 24 - w_
                ly = y - 26
                for _ in range(40):          # evită suprapunerea etichetelor
                    box = (lx - 4, ly - h_ / 2 - 2, lx + w_ + 4, ly + h_ / 2 + 2)
                    if not any(box[0] < q[2] and q[0] < box[2] and box[1] < q[3] and q[1] < box[3] for q in placed):
                        break
                    ly += 6
                placed.append(box)
                c.coords(tid, lx, ly)
                c.create_line(x, y, lx if right else lx + w_, ly, fill='#5d6d7e')
                c.create_oval(x - 2, y - 2, x + 2, y + 2, fill='#5d6d7e', outline='')
                r_ = c.create_rectangle(*box, fill='#ffffff', outline='#d0d4da')
                c.tag_raise(tid, r_)
        self._overlay()

    def _overlay(self):
        c, s = self.cv, self.app.sim
        key = self.app.hyd_phase()
        title, col, _ = PHASE_INFO[key]
        c.create_rectangle(10, 10, 430, 88, fill='white', outline='#d0d4da')
        c.create_text(20, 18, text=title, anchor='nw', font=('Segoe UI', 14, 'bold'), fill=col)
        i_open, o_open = s.valve_states()
        c.create_text(20, 46, anchor='nw', font=('Segoe UI', 9), fill=INK,
                      text=f'Supapa 7: {"DESCHISĂ" if i_open else "ÎNCHISĂ"}    Supapa 8: {"DESCHISĂ" if o_open else "ÎNCHISĂ"}'
                           f'    Pompa: {"PORNITĂ" if s.pump_on else "oprită"}')
        c.create_text(20, 64, anchor='nw', font=('Segoe UI', 9), fill=INK,
                      text=f'p CP = {fmt(s.p_mc, 0)} bar   p roată = {fmt(s.p_w, 0)} bar   '
                           f'v = {fmt(s.v * 3.6)} km/h   v roată = {fmt(s.omega * s.r * 3.6)} km/h')
        for k in range(50):
            c.create_rectangle(20 + k * 4, c.winfo_height() - 26, 24 + k * 4, c.winfo_height() - 14,
                               fill=pcolor(k * 140 / 50), outline='')
        c.create_text(228, c.winfo_height() - 20, text='presiune 0 … 140 bar', anchor='w',
                      font=('Segoe UI', 8), fill=MUTED)


def main():
    root = tk.Tk()
    App(root)
    root.mainloop()


if __name__ == '__main__':
    main()
