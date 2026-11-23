$csharpCode = @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public class LogoGenerator {
    public static void Generate(string outputPath) {
        int width = 512;
        int height = 512;
        using (Bitmap bmp = new Bitmap(width, height))
        using (Graphics g = Graphics.FromImage(bmp)) {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;

            // 1. Background Rounded Rectangle
            using (GraphicsPath path = new GraphicsPath()) {
                int radius = 105;
                int d = radius * 2;
                path.AddArc(0, 0, d, d, 180, 90);
                path.AddArc(width - d - 1, 0, d, d, 270, 90);
                path.AddArc(width - d - 1, height - d - 1, d, d, 0, 90);
                path.AddArc(0, height - d - 1, d, d, 90, 90);
                path.CloseFigure();

                using (LinearGradientBrush bgBrush = new LinearGradientBrush(
                    new Point(0, 0), new Point(width, height),
                    ColorTranslator.FromHtml("#16102e"), ColorTranslator.FromHtml("#070a14"))) {
                    g.FillPath(bgBrush, path);
                }

                // Ambient Radial Glow
                using (GraphicsPath glowPath = new GraphicsPath()) {
                    glowPath.AddEllipse(60, 60, 392, 392);
                    using (PathGradientBrush pgb = new PathGradientBrush(glowPath)) {
                        pgb.CenterColor = Color.FromArgb(120, 139, 92, 246);
                        pgb.SurroundColors = new Color[] { Color.FromArgb(0, 7, 10, 20) };
                        g.FillEllipse(pgb, 60, 60, 392, 392);
                    }
                }

                // Modern Outer Border
                using (Pen borderPen = new Pen(ColorTranslator.FromHtml("#3a2b66"), 4f)) {
                    g.DrawPath(borderPen, path);
                }
            }

            // 2. Center "W" Logo Poly Segments
            // Leg 1: Far Left Upstroke
            PointF[] leg1 = new PointF[] {
                new PointF(95, 140),
                new PointF(155, 140),
                new PointF(205, 375),
                new PointF(145, 375)
            };
            using (LinearGradientBrush b1 = new LinearGradientBrush(
                new PointF(95, 140), new PointF(205, 375),
                ColorTranslator.FromHtml("#7c3aed"), ColorTranslator.FromHtml("#4f46e5"))) {
                g.FillPolygon(b1, leg1);
            }

            // Leg 2: Left Center Diagonal
            PointF[] leg2 = new PointF[] {
                new PointF(145, 375),
                new PointF(205, 375),
                new PointF(285, 215),
                new PointF(230, 215)
            };
            using (LinearGradientBrush b2 = new LinearGradientBrush(
                new PointF(145, 375), new PointF(285, 215),
                ColorTranslator.FromHtml("#8b5cf6"), ColorTranslator.FromHtml("#c084fc"))) {
                g.FillPolygon(b2, leg2);
            }

            // Leg 3: Right Center Diagonal
            PointF[] leg3 = new PointF[] {
                new PointF(230, 215),
                new PointF(285, 215),
                new PointF(367, 375),
                new PointF(312, 375)
            };
            using (LinearGradientBrush b3 = new LinearGradientBrush(
                new PointF(230, 215), new PointF(367, 375),
                ColorTranslator.FromHtml("#c084fc"), ColorTranslator.FromHtml("#818cf8"))) {
                g.FillPolygon(b3, leg3);
            }

            // Leg 4: Far Right Upstroke
            PointF[] leg4 = new PointF[] {
                new PointF(312, 375),
                new PointF(367, 375),
                new PointF(417, 140),
                new PointF(357, 140)
            };
            using (LinearGradientBrush b4 = new LinearGradientBrush(
                new PointF(312, 375), new PointF(417, 140),
                ColorTranslator.FromHtml("#a855f7"), ColorTranslator.FromHtml("#06b6d4"))) {
                g.FillPolygon(b4, leg4);
            }

            // 3. Highlight Sparkle / Recommendation Star
            float sx = 405f, sy = 110f, sr = 24f;
            PointF[] star = new PointF[] {
                new PointF(sx, sy - sr),
                new PointF(sx + sr * 0.28f, sy - sr * 0.28f),
                new PointF(sx + sr, sy),
                new PointF(sx + sr * 0.28f, sy + sr * 0.28f),
                new PointF(sx, sy + sr),
                new PointF(sx - sr * 0.28f, sy + sr * 0.28f),
                new PointF(sx - sr, sy),
                new PointF(sx - sr * 0.28f, sy - sr * 0.28f)
            };
            using (LinearGradientBrush sb = new LinearGradientBrush(
                new PointF(sx - sr, sy - sr), new PointF(sx + sr, sy + sr),
                ColorTranslator.FromHtml("#38bdf8"), ColorTranslator.FromHtml("#e879f9"))) {
                g.FillPolygon(sb, star);
            }
            g.FillEllipse(Brushes.White, sx - 4f, sy - 4f, 8f, 8f);

            bmp.Save(outputPath, ImageFormat.Png);
        }
    }
}
"@

Add-Type -TypeDefinition $csharpCode -ReferencedAssemblies System.Drawing
[LogoGenerator]::Generate("C:\Users\fauge\.gemini\antigravity\scratch\W-Suggest\public\logo.png")
Write-Host "CSHARP_LOGO_GENERATED_SUCCESS"
