import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated,service_role;grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;`,
);
for (let run = 0; run < 2; run++)
  for (const file of [
    "01_schema",
    "02_functions",
    "03_rls",
    "04_storage",
    "05_seed",
  ]) {
    let sql = await readFile(
      new URL("../supabase/" + file + ".sql", import.meta.url),
      "utf8",
    );
    sql = sql.replace("create extension if not exists pgcrypto;", "");
    try {
      await db.exec(sql);
    } catch (e) {
      console.error("SQL failed:", file, e.message);
      throw e;
    }
  }
console.log("PASS: all SQL modules execute twice");
const users = {
  resident: "11111111-1111-4111-8111-111111111111",
  other: "22222222-2222-4222-8222-222222222222",
  operator: "33333333-3333-4333-8333-333333333333",
  outsider: "44444444-4444-4444-8444-444444444444",
  admin: "55555555-5555-4555-8555-555555555555",
  viewer: "66666666-6666-4666-8666-666666666666",
  editor: "77777777-7777-4777-8777-777777777777",
};
for (const [n, id] of Object.entries(users))
  await db.query("insert into auth.users(id,email) values($1,$2)", [
    id,
    n + "@test.invalid",
  ]);
const service = (
  await db.query(`select * from services where slug='demo-consultation'`)
).rows[0];
await db.query(
  `insert into departments(id,name,slug) values('88888888-8888-4888-8888-888888888888','Other department','other')`,
);
for (const name of ["operator", "outsider", "viewer"]) {
  await db.query(`insert into user_roles(user_id,role_name) values($1,$2)`, [
    users[name],
    name === "viewer" ? "viewer" : "operator",
  ]);
  await db.query(
    `insert into staff_departments(user_id,department_id) values($1,$2)`,
    [
      users[name],
      name === "outsider"
        ? "88888888-8888-4888-8888-888888888888"
        : service.department_id,
    ],
  );
}
await db.query(
  `insert into user_roles(user_id,role_name) values($1,'super_admin'),($2,'editor')`,
  [users.admin, users.editor],
);
async function as(name, fn) {
  await db.exec("reset role");
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [
    users[name] || "",
  ]);
  await db.exec("set role " + (name === "anon" ? "anon" : "authenticated"));
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
let aid, number;
await as("resident", async () => {
  aid = (
    await db.query("select save_draft($1,$2) as id", [
      service.id,
      {
        name: "Resident",
        email: "person@test.invalid",
        subject: "Консультація",
        description: "Long enough description",
        consent: true,
      },
    ])
  ).rows[0].id;
  assert.equal((await db.query("select * from applications")).rows.length, 1);
  number = (await db.query("select submit_application($1) as n", [aid])).rows[0]
    .n;
  assert.match(number, /^CK-\d{4}-\d{6}$/);
  assert.equal(
    (
      await db.query(
        "update applications set status='approved' where id=$1 returning id",
        [aid],
      )
    ).rows.length,
    0,
  );
});
await as("other", async () => {
  for (const t of [
    "applications",
    "application_answers",
    "application_status_history",
    "application_messages",
    "application_files",
    "notifications",
    "user_addresses",
    "user_documents",
  ])
    assert.equal((await db.query("select * from " + t)).rows.length, 0, t);
  await assert.rejects(db.query("select submit_application($1)", [aid]));
  await assert.rejects(
    db.query(`update profiles set blocked=true where user_id=$1`, [
      users.other,
    ]),
  );
  await assert.rejects(
    db.query(
      `insert into user_roles(user_id,role_name) values($1,'super_admin')`,
      [users.other],
    ),
  );
  await assert.rejects(
    db.query("select set_staff($1,$2,$3)", [users.other, ["admin"], []]),
  );
});
await as("outsider", async () => {
  assert.equal((await db.query("select * from applications")).rows.length, 0);
  await assert.rejects(
    db.query(`select change_application($1,'received')`, [aid]),
  );
});
await as("viewer", async () => {
  assert.equal((await db.query("select * from applications")).rows.length, 1);
  await assert.rejects(
    db.query(`select change_application($1,'received')`, [aid]),
  );
});
await as("editor", async () => {
  assert.equal((await db.query("select * from applications")).rows.length, 0);
  assert.equal((await db.query("select * from profiles")).rows.length, 1);
  await assert.rejects(
    db.query(`select change_application($1,'received')`, [aid]),
  );
});
await as("operator", async () => {
  assert.equal((await db.query("select * from applications")).rows.length, 1);
  await db.query(`select change_application($1,'received','Прийнято')`, [aid]);
  await db.query(
    `insert into application_messages(application_id,user_id,message,internal) values($1,$2,'Internal note',true)`,
    [aid, users.operator],
  );
  await db.query(
    `select change_application($1,'needs_more_info','Потрібен документ')`,
    [aid],
  );
});
await as("resident", async () => {
  assert.equal(
    (await db.query("select * from application_messages where internal")).rows
      .length,
    0,
  );
  assert.ok((await db.query("select * from notifications")).rows.length >= 3);
  await db.query(
    `insert into application_messages(application_id,user_id,message) values($1,$2,'Ось відповідь')`,
    [aid, users.resident],
  );
  await assert.rejects(
    db.query(
      `insert into application_messages(application_id,user_id,message,internal) values($1,$2,'Hidden',true)`,
      [aid, users.resident],
    ),
  );
  await assert.rejects(
    db.query(`select change_application($1,'approved')`, [aid]),
  );
  const cache = (await db.query(`select * from api_cache`)).rows;
  assert.ok(Array.isArray(cache));
});
await as("anon", async () => {
  assert.equal((await db.query("select * from applications")).rows.length, 0);
  assert.equal((await db.query("select * from profiles")).rows.length, 0);
  assert.equal((await db.query("select * from services")).rows.length, 3);
  await assert.rejects(db.query(`select save_draft($1,'{}')`, [service.id]));
  await assert.rejects(db.query("select acquire_alerts_lease()"));
});
await as("resident", async () => {
  const bad = (
    await db.query("select save_draft($1,$2) as id", [
      service.id,
      { name: "Test" },
    ])
  ).rows[0].id;
  await assert.rejects(db.query("select submit_application($1)", [bad]));
});
await as("admin", async () => {
  await db.query("select replace_service_form($1,$2)", [
    service.id,
    [
      {
        key: "required_email",
        type: "email",
        label: "Email",
        required: true,
        options: [],
        validation: {},
      },
    ],
  ]);
  assert.equal(
    (await db.query("select * from audit_logs where entity='user_roles'")).rows
      .length,
    5,
  );
});
await as("resident", async () => {
  assert.equal(
    (
      await db.query("select form_snapshot from applications where id=$1", [
        aid,
      ])
    ).rows[0].form_snapshot.length,
    6,
  );
  const d = (
    await db.query("select save_draft($1,$2) as id", [
      service.id,
      { required_email: "not-email" },
    ])
  ).rows[0].id;
  await assert.rejects(db.query("select submit_application($1)", [d]));
});
// Storage: another resident cannot access a known object path; metadata must reference actual owned objects.
const path = users.resident + "/" + aid + "/test.pdf";
await db.query(
  "insert into storage.objects(bucket_id,name) values('application-files',$1)",
  [path],
);
await as("other", async () => {
  assert.equal(
    (await db.query("select * from storage.objects where name=$1", [path])).rows
      .length,
    0,
  );
  assert.equal(
    (
      await db.query(`select file_access('application-files',$1,false) as ok`, [
        path,
      ])
    ).rows[0].ok,
    false,
  );
  await assert.rejects(
    db.query(
      `insert into application_files(application_id,user_id,name,path) values($1,$2,'fake',$3)`,
      [aid, users.other, path],
    ),
  );
});
await as("resident", async () => {
  assert.equal(
    (await db.query("select * from storage.objects where name=$1", [path])).rows
      .length,
    1,
  );
  await db.query(
    `insert into application_files(application_id,user_id,name,path,mime_type,size_bytes) values($1,$2,'test.pdf',$3,'application/pdf',30)`,
    [aid, users.resident, path],
  );
  await assert.rejects(
    db.query(
      `insert into application_files(application_id,user_id,name,path) values($1,$2,'missing',$3)`,
      [aid, users.resident, users.resident + "/" + aid + "/missing.pdf"],
    ),
  );
  await assert.rejects(
    db.query(`select set_staff($1,$2,$3)`, [users.other, ["admin"], []]),
  );
});
await as("admin", async () => {
  await db.query("select set_staff($1,$2,$3,true)", [
    users.other,
    ["operator"],
    [service.department_id],
  ]);
});
await as("other", async () => {
  assert.equal((await db.query("select * from applications")).rows.length, 0);
  await assert.rejects(db.query("select save_draft($1,'{}')", [service.id]));
});
console.log(
  "PASS: ownership, cross-department access, role isolation, transitions, immutable snapshots, required validation, audit, private storage, blocked users",
);
await db.close();
