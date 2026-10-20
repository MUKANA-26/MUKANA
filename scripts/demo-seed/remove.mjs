// Removes ALL demo data created by seed.mjs (every account with an @demo.mukana.test email and everything they own).
import { DEMO_DOMAIN, log, svc } from "./config.mjs";

const users = [];
for (let page = 1; page < 20; page++) {
  const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  users.push(...data.users.filter((u) => u.email?.endsWith(`@${DEMO_DOMAIN}`)));
  if (data.users.length < 1000) break;
}
const ids = users.map((u) => u.id);
log(`Found ${ids.length} demo accounts.`);

if (ids.length) {
  const { data: comps } = await svc.from("companies").select("id").in("owner_id", ids);
  const companyIds = (comps ?? []).map((c) => c.id);

  // Rows that survive their creator being deleted.
  await svc.from("events").delete().in("host_id", ids);
  await svc.from("groups").delete().in("created_by", ids);

  // Files.
  async function emptyFolder(bucket, folder) {
    for (let guard = 0; guard < 20; guard++) {
      const { data } = await svc.storage.from(bucket).list(folder, { limit: 100 });
      if (!data?.length) return;
      await svc.storage.from(bucket).remove(data.map((f) => `${folder}/${f.name}`));
      if (data.length < 100) return;
    }
  }
  const jobs = [
    ...ids.flatMap((id) => ["avatars", "cvs", "placement-letters", "post-media"].map((b) => [b, id])),
    ...companyIds.flatMap((id) => ["company-logos", "verification-docs"].map((b) => [b, id])),
  ];
  let i = 0;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (i < jobs.length) {
        const [bucket, folder] = jobs[i++];
        await emptyFolder(bucket, folder);
      }
    }),
  );
  log("Files removed.");

  // Accounts (profiles, companies, opportunities, applications, posts, chats and so on cascade).
  let done = 0;
  let k = 0;
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      while (k < ids.length) {
        const id = ids[k++];
        const { error } = await svc.auth.admin.deleteUser(id);
        if (error) log("  could not delete", id, error.message);
        else done++;
      }
    }),
  );
  log(`Deleted ${done} accounts and everything they owned.`);
}
log("Demo data removed.");
