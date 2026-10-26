import { getAuthHeaders } from '../utils/authAccess';
export async function driveApi(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la acción.');
  return data;
}

let pickerLoader: Promise<void> | undefined;
export async function pickDriveFiles(projectId: string): Promise<string[]> {
  const { token, apiKey, appId } = await driveApi(`/api/web-automation/${projectId}/picker`);
  if (!pickerLoader) pickerLoader = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => (window as any).gapi.load('picker', { callback: resolve, onerror: reject });
    script.onerror = reject;
    document.head.appendChild(script);
  }).catch(e => { pickerLoader = undefined; throw e; });
  await pickerLoader;
  return new Promise(resolve => {
    const picker = (window as any).google.picker;
    new picker.PickerBuilder().setOAuthToken(token).setDeveloperKey(apiKey).setAppId(appId)
      .setOrigin(window.location.origin).setLocale('es').addView(new picker.DocsView().setIncludeFolders(false))
      .enableFeature(picker.Feature.MULTISELECT_ENABLED)
      .setCallback((data: any) => {
        if (data.action === picker.Action.PICKED) resolve(data.docs.map((d: any) => d.id));
        if (data.action === picker.Action.CANCEL) resolve([]);
      }).build().setVisible(true);
  });
}
