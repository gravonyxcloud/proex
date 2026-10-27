// allow-vercel-ips.mjs
// Cria regras "Allow" no Cloudflare WAF para IPs de saída da Vercel (Serverless/Edge)
// Rode: node allow-vercel-ips.mjs
// Requer: CF_API_TOKEN e CF_ZONE_ID no ambiente

import fetch from 'node-fetch';

const ZONE_ID = process.env.CF_ZONE_ID;   // ex: "023e105f4ecef8ad9ca31a8372d0c353"
const TOKEN   = process.env.CF_API_TOKEN;
if (!ZONE_ID || !TOKEN) {
  console.error('Defina CF_ZONE_ID e CF_API_TOKEN no ambiente.');
  process.exit(1);
}

// IPs atuais da Vercel (out/2024) – confira https://vercel.com/docs/ip-ranges antes de rodar
const CIDRS = [
  // IPv4 Serverless / Edge
  '76.76.21.0/24',
  '76.223.0.0/16',
  '76.223.64.0/18',
  '76.223.128.0/17',
  '76.223.128.0/18',
  '76.223.192.0/18',
  '76.223.192.0/19',
  '76.223.224.0/19',
  '76.223.240.0/20',
  '76.223.248.0/21',
  '76.223.252.0/22',
  '76.223.254.0/23',
  '76.223.255.0/24',
  // IPv6 Edge (opcional – só se seu gateway aceita v6)
  '2600:1f14::/32',
  '2600:1f18::/32',
  '2600:1f1c::/32',
  '2600:1f20::/32',
  '2600:1f24::/32',
  '2600:1f28::/32',
  '2600:1f2c::/32',
  '2600:1f30::/32',
  '2600:1f34::/32',
  '2600:1f38::/32',
];

const BASE = `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/firewall/access_rules/rules`;
const HDRS = {
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

async function main() {
  // 1) lista regras existentes p/ não duplicar
  const listRes = await fetch(`${BASE}?per_page=500`, { headers: HDRS });
  const listJson = await listRes.json();
  if (!listJson.success) throw new Error('Falha ao listar: ' + JSON.stringify(listJson.errors));

  const existing = new Set(
    listJson.result
      .filter(r => r.mode === 'allow' && r.notes?.includes('Vercel'))
      .map(r => r.configuration.value)
  );

  // 2) cria as que faltam
  for (const cidr of CIDRS) {
    if (existing.has(cidr)) {
      console.log(`✔ já existe: ${cidr}`);
      continue;
    }
    const payload = {
      mode: 'allow',
      configuration: { target: 'ip_range', value: cidr },
      notes: 'Vercel outbound – Serverless/Edge Functions (auto)',
    };
    const cre = await fetch(BASE, { method: 'POST', headers: HDRS, body: JSON.stringify(payload) });
    const j = await cre.json();
    if (j.success) console.log(`✅ criada: ${cidr}`);
    else console.error(`❌ erro ${cidr}:`, j.errors);
  }
  console.log('🎉 Fim.');
}

main().catch(e => { console.error(e); process.exit(1); });