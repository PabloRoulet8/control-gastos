import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAICES = ['js', 'sw.js'];

function listarModulos(ruta) {
    if (statSync(ruta).isFile()) return [ruta];

    return readdirSync(ruta, { withFileTypes: true }).flatMap(entrada => {
        const completa = join(ruta, entrada.name);
        if (entrada.isDirectory()) return listarModulos(completa);
        return entrada.name.endsWith('.js') ? [completa] : [];
    });
}

const raiz = fileURLToPath(new URL('..', import.meta.url));
const modulos = RAICES.flatMap(ruta => listarModulos(resolve(raiz, ruta)));
const fallidos = [];

for (const modulo of modulos) {
    const resultado = spawnSync(process.execPath, ['--check', modulo], { encoding: 'utf8' });

    if (resultado.status === 0) {
        console.log(`ok  ${relative(raiz, modulo)}`);
        continue;
    }

    fallidos.push(relative(raiz, modulo));
    console.error(`ERROR ${relative(raiz, modulo)}\n${resultado.stderr?.trim() ?? ''}`);
}

if (fallidos.length > 0) {
    console.error(`\n${fallidos.length} módulo(s) con errores de sintaxis.`);
    process.exit(1);
}

console.log(`\n${modulos.length} módulos verificados con node --check.`);
