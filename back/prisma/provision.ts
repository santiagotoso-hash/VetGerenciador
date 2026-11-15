/**
 * Provisionamento (rodar contra o banco configurado em DATABASE_URL):
 *
 *   npm run provision -- superadmin --name "Fulano" --email fulano@exemplo.com --password "Senha@123"
 *
 *   npm run provision -- company --name "Minha Clínica" \
 *       --admin "Nome|email|senha" --user "Atendente|email|senha" [--user "Outro|email|senha|VETERINARIAN"]
 *
 * Nada é sobrescrito: se a empresa (mesmo nome) ou um e-mail já existir, o script avisa e segue.
 * Perfis possíveis no --user: ADMIN, VETERINARIAN, RECEPTIONIST (padrão), GROOMER.
 */
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function parse(argv: string[]) {
  const out: Record<string, string[]> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) (out[argv[i].slice(2)] ??= []).push(argv[++i] ?? '');
  }
  return out;
}

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'empresa';

async function ensureUser(data: { name: string; email: string; password: string; role: Role; companyId: string | null }) {
  const email = data.email.trim().toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    console.log(`= já existe: ${email} (${exists.role}) — mantido como está`);
    return;
  }
  await prisma.user.create({ data: { ...data, email, password: await bcrypt.hash(data.password, 10) } });
  console.log(`+ criado: ${email} (${data.role})`);
}

function userArg(spec: string, defaultRole: Role) {
  const [name, email, password, role] = spec.split('|').map((s) => s?.trim());
  if (!name || !email || !password) throw new Error(`Usuário inválido: "${spec}" (use "Nome|email|senha[|PERFIL]")`);
  if (password.length < 6) throw new Error(`Senha muito curta para ${email} (mínimo 6)`);
  const r = (role as Role) ?? defaultRole;
  if (!['ADMIN', 'VETERINARIAN', 'RECEPTIONIST', 'GROOMER'].includes(r)) throw new Error(`Perfil inválido: ${role}`);
  return { name, email, password, role: r };
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const a = parse(rest);
  const one = (k: string) => a[k]?.[0];

  if (cmd === 'superadmin') {
    const [name, email, password] = [one('name'), one('email'), one('password')];
    if (!name || !email || !password) throw new Error('Informe --name, --email e --password');
    await ensureUser({ name, email, password, role: 'SUPER_ADMIN', companyId: null });
  } else if (cmd === 'company') {
    const name = one('name');
    if (!name || !one('admin')) throw new Error('Informe --name e --admin "Nome|email|senha"');
    const slug = slugify(name);
    let company = await prisma.company.findUnique({ where: { slug } });
    if (company) console.log(`= empresa já existe: ${company.name}`);
    else {
      company = await prisma.company.create({ data: { name, slug } });
      console.log(`+ empresa criada: ${name} (${slug})`);
    }
    await ensureUser({ ...userArg(one('admin')!, 'ADMIN'), role: 'ADMIN', companyId: company.id });
    for (const u of a.user ?? []) await ensureUser({ ...userArg(u, 'RECEPTIONIST'), companyId: company.id });
  } else {
    console.log('Uso: provision superadmin|company (veja o cabeçalho de prisma/provision.ts)');
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
