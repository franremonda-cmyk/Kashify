import { readFileSync } from "fs";

const indice = JSON.parse(readFileSync("typeform_data/_indice.json", "utf-8"));

const niveles = ["A1", "A2", "B1", "B2", "C1"];
const resultado = {};

for (const nivel of niveles) {
  resultado[nivel] = { Lesen: 0, Hören: 0 };
}

for (const item of indice) {
  const titulo = item.titulo;

  for (const nivel of niveles) {
    if (titulo.startsWith(`${nivel} Lesen-`)) {
      resultado[nivel].Lesen++;
    }
    if (titulo.startsWith(`${nivel} Hören-`)) {
      resultado[nivel].Hören++;
    }
  }
}

console.log("Conteo por nivel:\n");

let hayProblemas = false;

for (const nivel of niveles) {
  const { Lesen, Hören } = resultado[nivel];
  const lesenOk = Lesen === 12 ? "✅" : "❌";
  const horenOk = Hören === 6 ? "✅" : "❌";

  if (Lesen !== 12 || Hören !== 6) hayProblemas = true;

  console.log(`${nivel}:`);
  console.log(`  Lesen: ${Lesen}/12 ${lesenOk}`);
  console.log(`  Hören: ${Hören}/6 ${horenOk}`);
  console.log();
}

if (!hayProblemas) {
  console.log("🎉 Todos los niveles tienen la cantidad correcta de formularios.");
} else {
  console.log("⚠️ Hay niveles con cantidades distintas a lo esperado (revisar arriba).");
}
