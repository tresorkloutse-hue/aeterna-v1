// Génère un slug URL-safe de 8 caractères
// Compatible Edge runtime
export function generateSlug(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result  = ''
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  array.forEach(n => { result += chars[n % chars.length] })
  return result
}
