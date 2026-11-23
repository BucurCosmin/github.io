# Simulator de reglare a frecvenței – grup diesel-generator naval

Aplicație web didactică (backend Python) pentru Curs 4 – *Reglarea automată a frecvenței și a puterii active*.
Interfața reproduce panourile din camera de comandă a mașinilor: generatorul DG1 cu instrumente analogice,
regulatorul de turație, înregistratorul, sistemul de alarmă și tabloul consumatorilor cu pornitoare.
Operatorul pornește motorul, închide ACB-ul și cuplează sau decuplează consumatori. Pe instrumente și pe
înregistrator se văd căderea de turație și reglarea ei.

## Pornire

Pe GitHub Pages, deschideți `static/index.html`: modelul Python rulează direct în browser prin Pyodide,
fără server. La prima încărcare este necesară o conexiune la internet pentru descărcarea Pyodide.
Fiecare filă are propria simulare.

Pentru rularea cu serverul local:

```bash
pip install -r requirements.txt
python app.py
```

Deschideți apoi <http://localhost:8000>. În laborator, serverul poate rula pe un singur calculator, iar studenții
se conectează la `http://<IP-server>:8000`. Fiecare fereastră de browser are propria simulare, independentă.

Testele modelului: `python -m pytest -q`.

## Ce se poate face

- **Generator:** START / STOP motor (lansare cu aer), ÎNCHIDE / DESCHIDE ACB. ACB-ul se închide numai cu motorul la
  turație și tensiune.
- **Regulator:** comutator STATISM / IZOCRON, statism reglabil 0–8 %, butoanele MĂRIRE / MICȘORARE (se țin apăsate)
  pentru consemnul de turație, anticiparea sarcinii (semnal de putere adăugat comenzii).
- **Consumatori:** 11 plecări, cu pornire directă (curent de pornire 5,5·In, cos φ scăzut), consumatori rezistivi
  și un thruster cu convertizor (rampă de putere, comandă 0–100 %).
- **Protecții și alarme:** frecvență și tensiune în afara limitelor, suprasarcină, deconectare preferențială în
  două trepte, declanșarea ACB pe subfrecvență și pe supracurent, oprire la supraturație (115 %), black-out, blocarea
  pornirii consumatorilor mari (*heavy consumer start*), limitarea combustibilului de către turbosuflantă.
- **Timp:** pauză, ×0,25, ×0,5, ×1, ×2 – utile pentru a urmări tranzitoriile.

## Modelul (sim/model.py)

Mărimi în unități relative față de P~n~ = 400 kW și n~n~ = 1500 rot/min.

| Element | Model |
|---|---|
| Ecuația de mișcare | 2H·dω/dt = (Pₘ − Pₑ − pierderi)/ω, H = 1,2 s |
| Motor diesel | timp mort de injecție 30 ms + întârzierea arderii 60 ms; Pₘ ∝ cremalieră · ω |
| Turbosuflantă | constantă de timp 2 s; limitare de fum: cremaliera maximă = 0,62 + 0,55·p_boost |
| Regulator | PID (Kp = 25, Ki = 20, Kd = 1), consemn n_ref = n_set − s·P (statism pe putere), anti-windup |
| Sarcini | pompe P ∝ ω³, compresoare/vinciuri P ∝ ω, rezistive P ∝ U²; pornire directă 2–3 s |
| AVR | cădere de tensiune ∝ x'd·ΔQ, revenire cu constanta de timp 0,35 s; limitare V/Hz |

Valorile sunt didactice și nu reprezintă un motor anume. Parametrii se modifică în clasa `Genset`, iar lista
consumatorilor în `default_consumers()`.

## Propuneri de lucrări de laborator

1. **Caracteristica statică.** Cu statism de 4 %, porniți consumatorii pe rând și notați f și P în regim stabilizat.
   Trasați f(P) și determinați statismul; comparați cu relația Δf = −k~s~·ΔP.
2. **Corecția consemnului.** La o sarcină de ~250 kW readuceți frecvența la 50 Hz cu butonul MICȘORARE. Ce s-a
   întâmplat cu f₀? Explicați cu figura de deplasare paralelă a caracteristicii din curs.
3. **Izocron vs. statism.** Repetați aceeași treaptă de sarcină în ambele moduri; comparați abaterea maximă,
   timpul de revenire și frecvența finală.
4. **Cerințele IACS UR M3.** Porniți simultan macaraua și pompa de balast. Verificați pe înregistrator abaterea
   tranzitorie (≤ 10 %) și revenirea în banda de ±1 % (≤ 5 s). Ce se întâmplă dacă adăugați și pompa de incendiu?
5. **Limitarea de combustibil.** Observați lampa „Limitare combustibil” și presiunea aerului de supraalimentare la
   o treaptă mare de sarcină pornind de la gol. De ce cer regulile mai multe trepte de încărcare?
6. **Anticiparea sarcinii.** Comparați căderea de frecvență la aceeași treaptă, cu și fără anticipare.
7. **Protecții.** Încărcați generatorul peste 100 % și urmăriți deconectarea preferențială. Deschideți ACB-ul la
   sarcină mare și observați creșterea turației (aruncarea de sarcină) față de pragul de 115 %.
8. **Consumator mare.** Încercați pornirea thrusterului la 100 % și apoi la 50 %. De ce este blocată prima pornire?

## Structură

```
app.py              server FastAPI: pagina, fișiere statice, WebSocket /ws (20 actualizări/s)
sim/model.py        modelul dinamic, protecțiile, alarmele
static/index.html   panourile tabloului
static/style.css    aspectul (RAL 7035, plăcuțe gravate, lămpi, butoane)
static/gauges.js    instrumentele analogice (SVG)
static/app.js       legătura WebSocket, instrumente, înregistrator, anunțiator, sirenă
tests/test_sim.py   verificări ale modelului (statism, izocron, UR M3, protecții)
```
