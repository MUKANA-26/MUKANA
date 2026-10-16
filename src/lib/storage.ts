/** Public URL for an object in the public `company-logos` bucket. */
export function companyLogoUrl(path: string | null | undefined): string | null {
  if (!path || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/company-logos/${path}`;
}
