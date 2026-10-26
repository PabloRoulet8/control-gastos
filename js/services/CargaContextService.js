import { GastoRepository } from "../api/GastoRepository.js";
import { CategoryService } from "./CategoryService.js";
import { PerfilPublicoService } from "./PerfilPublicoService.js";

export class CargaContextService {
    constructor({
        repository = new GastoRepository(),
        perfilService = PerfilPublicoService
    } = {}) {
        this.repository = repository;
        this.perfilService = perfilService;
    }

    async cargar({
        userId,
        ambitoActual = "personal",
        hogarId = null,
        hogarNombre = null
    } = {}) {
        if (!userId) {
            throw new Error("El usuario es obligatorio.");
        }

        const usuario = await this.repository.obtenerUsuario(userId) || {};

        if (ambitoActual === "hogar") {
            return this.#cargarHogar({ usuario, hogarId, hogarNombre });
        }

        return {
            ambito: "personal",
            usuario,
            hogar: null,
            categorias: CategoryService.obtenerCategoriasParaAmbito("personal", {
                personales: usuario.categorias_personales || []
            }),
            titulo: "Gastos Personales",
            subtitulo: "¿Qué gasto vas a anotar?",
            mostrarResponsable: false,
            miembros: []
        };
    }

    async cargarResponsables(miembros = [], userId = null) {
        const responsables = [];
        const cacheNombres = new Map();
        const listaMiembros = Array.isArray(miembros) ? miembros : [];

        for (const uid of listaMiembros) {
            if (!cacheNombres.has(uid)) {
                const perfil = await this.perfilService.obtener(uid);
                cacheNombres.set(uid, perfil?.nombre || "Usuario");
            }

            responsables.push({
                uid,
                nombre: cacheNombres.get(uid),
                seleccionado: uid === userId
            });
        }

        return responsables;
    }

    async #cargarHogar({ usuario, hogarId, hogarNombre }) {
        const contexto = {
            ambito: "hogar",
            usuario,
            hogar: null,
            categorias: null,
            titulo: null,
            subtitulo: null,
            mostrarResponsable: true,
            miembros: []
        };

        if (!hogarId) return contexto;

        const hogar = await this.repository.obtenerHogar(hogarId);
        if (!hogar) return contexto;

        return {
            ...contexto,
            hogar,
            categorias: CategoryService.obtenerCategoriasParaAmbito("hogar", {
                hogar: hogar.categorias_compartidas || []
            }),
            titulo: hogarNombre || hogar.nombre,
            subtitulo: "¿Qué gasto de la casa vas a anotar?",
            miembros: Array.isArray(hogar.miembros) ? hogar.miembros : []
        };
    }
}
