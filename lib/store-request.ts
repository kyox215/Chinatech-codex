/** Transport failures have a reviewed, translatable recovery message. */
export async function readStoreJson(path: string, init: RequestInit, unavailable = '暂时无法读取账号，请稍后重试。') {
  try {
    const response = await fetch(path, init);
    const data = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return { response, data: !response.ok && (typeof data.message !== 'string' || !data.message.trim()) ? { ...data, message: unavailable } : data };
  } catch {
    throw new Error(unavailable);
  }
}
