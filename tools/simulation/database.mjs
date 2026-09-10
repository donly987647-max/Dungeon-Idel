import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

export const root=fileURLToPath(new URL('../../',import.meta.url));
export const baseline=JSON.parse(readFileSync(root+'docs/system-baseline-v0142.json','utf8'));
const metadata=JSON.parse(readFileSync(root+'docs/system-schema-metadata-v0142.json','utf8'));
const qi=s=>'"'+s.replaceAll('"','""')+'"';

// A private in-memory PostgreSQL with synthetic auth only. No server credentials,
// player telemetry or network database access. This executes actual server SQL.
export async function createDatabase(){
  const db=new PGlite();
  await db.exec(`create schema auth;
    create role anon; create role authenticated; create role service_role bypassrls;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    set check_function_bodies=off;`);
  for(const table of new Set(baseline.columns.map(c=>c.table))){
    const columns=baseline.columns.filter(c=>c.table===table).map(c=>{
      const type=c.type==='ARRAY'?c.udt.slice(1)+'[]':c.udt;
      return `${qi(c.column)} ${type}${c.default?' default '+c.default:''}${c.nullable==='NO'?' not null':''}`;
    });
    await db.exec(`create table public.${qi(table)} (${columns.join(',')});`);
  }
  // Key constraints precede foreign keys because snapshot order is arbitrary.
  for(const constraint of [...baseline.constraints].sort((a,b)=>Number(a.definition.startsWith('FOREIGN KEY'))-Number(b.definition.startsWith('FOREIGN KEY')))){
    await db.exec(`alter table ${qi(constraint.table)} add constraint ${qi(constraint.name)} ${constraint.definition};`);
  }
  for(const fn of baseline.functions)await db.exec(fn.definition+';');
  const tables={items:'game_item_defs',sites:'game_hunt_sites',recipes:'game_recipes',skills:'game_skill_defs',evolutions:'game_evolution_defs'};
  for(const [key,table] of Object.entries(tables))for(const row of baseline[key]){
    const keys=Object.keys(row);
    await db.query(`insert into ${table} (${keys.map(qi).join(',')}) values (${keys.map((_,i)=>'$'+(i+1)).join(',')})`,keys.map(k=>{
      const value=row[k],column=baseline.columns.find(c=>c.table===table&&c.column===k);
      return column?.udt==='jsonb'&&value!==null?JSON.stringify(value):value;
    }));
  }
  for(const index of metadata.indexes)await db.exec(index.replace(/^(CREATE (?:UNIQUE )?INDEX) /,'$1 IF NOT EXISTS ')+';');
  for(const trigger of metadata.triggers)await db.exec(trigger+';');
  return db;
}
