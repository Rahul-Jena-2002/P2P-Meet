using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;

internal static class Launcher {
  private static async Task PumpInput(Stream source, Stream destination) {
    await source.CopyToAsync(destination);
    destination.Close();
  }

  private static int Main() {
    string script = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "host.ps1");
    string escapedScript = script.Replace("'", "''");
    var start = new ProcessStartInfo("powershell.exe",
      "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command \"& '" + escapedScript + "'\"") {
      UseShellExecute = false, CreateNoWindow = true,
      RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true
    };
    using (var child = Process.Start(start)) {
      if (child == null) return 1;
      Task input = PumpInput(Console.OpenStandardInput(), child.StandardInput.BaseStream);
      Task output = child.StandardOutput.BaseStream.CopyToAsync(Console.OpenStandardOutput());
      Task error = child.StandardError.BaseStream.CopyToAsync(Console.OpenStandardError());
      child.WaitForExit();
      try { Task.WaitAll(new[] { input, output, error }, 2000); } catch { }
      return child.ExitCode;
    }
  }
}
