using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;
using System.Text.Json;
using System.Text.Json.Serialization;
using EspSim.Core.Brakes;
using EspSim.Core.Control;
using EspSim.Core.Model;
using EspSim.Core.Scenarios;
using EspSim.Core.Simulation;

// Punctul de intrare nu face nimic: funcțiile de mai jos sunt apelate din js/wasm-api.js.
return;

/// <summary>
/// Aceleași rute ca în EspSim.Web/Program.cs, expuse către JavaScript.
/// Fiecare funcție primește/întoarce JSON, cu aceleași opțiuni de serializare ca serverul.
/// </summary>
[SupportedOSPlatform("browser")]
public static partial class EspApi
{
    static readonly JsonSerializerOptions Json = CreateOptions();

    static JsonSerializerOptions CreateOptions()
    {
        var o = new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals | JsonNumberHandling.AllowReadingFromString,
            // ca în ASP.NET Core: diacriticele rămân necodificate în JSON
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        };
        o.Converters.Add(new JsonStringEnumConverter());
        return o;
    }

    static string Ok(object value) => JsonSerializer.Serialize(value, Json);
    static T Read<T>(string body) where T : new() =>
        string.IsNullOrWhiteSpace(body) ? new T() : JsonSerializer.Deserialize<T>(body, Json) ?? new T();

    [JSExport]
    public static string Scenarios() => Ok(ScenarioLibrary.All.Select(s => new
    {
        s.Id, s.Title, s.Short, s.Description, s.BookReference, s.Observe,
        s.DefaultSpeedKmh, s.DefaultMu, drivetrain = s.DefaultDrivetrain.ToString(),
        s.SupportsSteeringScale, s.IsSineWithDwell,
        systemsA = s.SystemsA, systemsB = s.SystemsB, s.LabelA, s.LabelB, s.DefaultCharts,
    }));

    [JSExport]
    public static string Vehicle()
    {
        var p = new VehicleParameters();
        return Ok(new
        {
            parameters = p,
            derived = new
            {
                wheelbase = p.Wheelbase,
                staticLoadFront = Math.Round(p.StaticWheelLoad(0)),
                staticLoadRear = Math.Round(p.StaticWheelLoad(2)),
                corneringStiffFront = Math.Round(p.AxleCorneringStiffness(true)),
                corneringStiffRear = Math.Round(p.AxleCorneringStiffness(false)),
                understeerGradient = p.UndersteerGradient,
                characteristicSpeedKmh = Math.Sqrt(p.Wheelbase / p.UndersteerGradient) * 3.6,
            },
            tuning = new EspTuning(),
        });
    }

    /// <summary>Întoarce JSON-ul rezultatului sau, la scenariu inexistent, „!404 mesaj”.</summary>
    [JSExport]
    public static string Simulate(string body)
    {
        var req = Read<SimRequest>(body);
        try
        {
            var opt = new ScenarioOptions
            {
                SpeedKmh = Clamp(req.SpeedKmh, 10, 220),
                Mu = Clamp(req.Mu, 0.05, 1.2),
                SteeringScale = Clamp(req.SteeringScale, 0.2, 2.5),
                Drivetrain = req.Drivetrain,
                ExtraMassKg = Math.Clamp(req.ExtraMassKg, 0, 600),
                SystemsA = req.SystemsA,
                SystemsB = req.SystemsB,
                Tuning = req.Tuning,
                SensorNoise = req.SensorNoise,
                IdealMu = req.IdealMu,
                SwdMultiplier = Clamp(req.SwdMultiplier, 1, 10),
            };
            return Ok(SimulationService.Run(req.ScenarioId, opt));
        }
        catch (KeyNotFoundException e) { return "!404 " + e.Message; }
    }

    [JSExport]
    public static string BrakeFunctionList() => Ok(BrakeFunctions.All);

    [JSExport]
    public static string AbsCycleRun(string body)
    {
        var o = JsonSerializer.Deserialize<AbsCycle.Options>(body, Json)!;
        return Ok(AbsCycle.Run(o with
        {
            SpeedKmh = Math.Clamp(o.SpeedKmh, 20, 200), Mu = Math.Clamp(o.Mu, 0.05, 1.2), Mu2 = Math.Clamp(o.Mu2, 0.05, 1.2),
            Pedal = Math.Clamp(o.Pedal, 20, 200),
        }));
    }

    [JSExport]
    public static string Distribution(string body) =>
        Ok(BrakeDistribution.Compute(JsonSerializer.Deserialize<BrakeDistribution.Options>(body, Json)!));

    [JSExport]
    public static string BrakeFunction(string id, string body)
    {
        var prm = JsonSerializer.Deserialize<Dictionary<string, double>>(string.IsNullOrWhiteSpace(body) ? "{}" : body, Json) ?? new();
        try { return Ok(BrakeFunctions.Run(id, prm)); }
        catch (KeyNotFoundException e) { return "!404 " + e.Message; }
    }

    static double? Clamp(double? v, double lo, double hi) => v is null ? null : Math.Clamp(v.Value, lo, hi);
}

public sealed record SimRequest
{
    public string ScenarioId { get; init; } = "s-bend";
    public double? SpeedKmh { get; init; }
    public double? Mu { get; init; }
    public double? SteeringScale { get; init; }
    public Drivetrain? Drivetrain { get; init; }
    public double ExtraMassKg { get; init; }
    public SystemConfig? SystemsA { get; init; }
    public SystemConfig? SystemsB { get; init; }
    public EspTuning? Tuning { get; init; }
    public bool SensorNoise { get; init; }
    public bool IdealMu { get; init; }
    public double? SwdMultiplier { get; init; }
}
