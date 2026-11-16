namespace WebABS;

public sealed record PlotLine(string Name, string Color, IReadOnlyList<(double X, double Y)> Values);
