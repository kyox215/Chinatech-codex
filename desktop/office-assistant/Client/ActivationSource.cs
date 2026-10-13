using System.Net.Http;
using System.Text.Json;

namespace ChinaTech.OfficeAssistant;

public static class ActivationSource {
 public static async Task<string> ResolveAsync() {
  using var http = new HttpClient { Timeout = Timeout.InfiniteTimeSpan };
  return await ResolveAsync(http, TimeSpan.FromSeconds(12));
 }

 internal static async Task<string> ResolveAsync(HttpClient http, TimeSpan timeout) {
  try {
   // ResponseHeadersRead ends HttpClient.Timeout at the headers; one deadline covers the body too.
   using var deadline = new CancellationTokenSource(timeout);
   using var response = await http.GetAsync("https://info.302.pub/api/server/info", HttpCompletionOption.ResponseHeadersRead, deadline.Token);
   response.EnsureSuccessStatusCode();
   // Only the advertised server field is retained, never client records from this API.
   using var stream = await response.Content.ReadAsStreamAsync(deadline.Token);
   using var json = JsonDocument.Parse(await ExecutionSafety.ReadBoundedAsync(stream, 65536, deadline.Token));
   var root = json.RootElement;
   if (root.TryGetProperty("data", out var data)) root = data;
   return Policy.ValidateServer(root.GetProperty("kms_server_address").GetString() ?? "");
  } catch { return "k.302.pub"; }
 }
}
