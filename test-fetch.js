import fs from 'fs';
async function run() {
  const response = await fetch('http://localhost:3000/api/scihub/download/10.1016/j.watres.2006.12.019');
  console.log('ok:', response.ok, 'status:', response.status);
  const blob = await response.blob();
  const buffer = Buffer.from(await blob.arrayBuffer());
  fs.writeFileSync('test-fetch.pdf', buffer);
  console.log('wrote', buffer.length, 'bytes');
}
run();
