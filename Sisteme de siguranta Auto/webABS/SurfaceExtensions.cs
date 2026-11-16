using AbsSim.Core.Model;

namespace WebABS;

public static class SurfaceExtensions
{
    public static int IndexOfSurface(this IReadOnlyList<Surface> surfaces, Surface surface)
    {
        for (int i = 0; i < surfaces.Count; i++)
            if (ReferenceEquals(surfaces[i], surface)) return i;
        return 0;
    }
}
