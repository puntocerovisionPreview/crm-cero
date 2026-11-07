import React from 'react';
import { CalendarCheck, KeyRound, MessageCircle, Play } from 'lucide-react';
import { Project } from '../types';
import { type TemaPlantilla } from '../portal/presencia';
import {
  ACCESO_ESTADO_LABEL, TRABAJO_NUESTRO, accesosDelAlcance, estadoAcceso, inicioPrograma, mensajeAccesos,
  semanaDelPrograma, temasParaEmpezar, temasSinAgenda, type AccesoEstadoId, type AccesoId,
} from '../portal/presenciaAuto';
import { formatWhatsAppUrl } from '../utils/contact';
import { getTodayString } from '../utils/storage';

const ORDEN: AccesoEstadoId[] = ['falta', 'pedido', 'concedido', 'no_aplica'];
const CHIP: Record<AccesoEstadoId, string> = {
  falta: 'border-amber-400/40 text-amber-200',
  pedido: 'border-sky-500/40 text-sky-200',
  concedido: 'border-emerald-500/40 text-emerald-300',
  no_aplica: 'border-zinc-700 text-zinc-500',
};
const CORREO_CERO = 'puntocerovision@gmail.com';

/**
 * PRESENCIA CASI AUTOMÁTICA (arriba del plan): en qué semana está, qué temas toca empezar,
 * lo tuyo de cada tema directo a tu agenda y los accesos que hacen falta según lo contratado.
 */
export const PafPlanAuto: React.FC<{
  project: Project;
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  onEmpezar: (temas: TemaPlantilla[]) => void;
  onAgendar?: (temas: TemaPlantilla[]) => void;
}> = ({ project, onUpdateProject, onEmpezar, onAgendar }) => {
  const today = getTodayString();
  const inicio = inicioPrograma(project);
  const semana = inicio ? semanaDelPrograma(inicio, today) : null;
  const toca = temasParaEmpezar(project, today);
  const sinAgenda = onAgendar ? temasSinAgenda(project) : [];
  const accesos = accesosDelAlcance(project.pafAlcance || []);
  const faltan = accesos.filter((a) => estadoAcceso(project, a.id).estado === 'falta');
  const nombre = project.ownerName || project.clientName;
  const texto = mensajeAccesos(nombre, faltan, CORREO_CERO);

  const setAcceso = (id: AccesoId, estado: AccesoEstadoId) =>
    onUpdateProject(project.id, { pafAccesos: { ...(project.pafAccesos || {}), [id]: { estado, fecha: today } } });
  const siguiente = (id: AccesoId) => setAcceso(id, ORDEN[(ORDEN.indexOf(estadoAcceso(project, id).estado) + 1) % ORDEN.length]);
  const marcarPedidos = () => {
    const next = { ...(project.pafAccesos || {}) };
    faltan.forEach((a) => { next[a.id] = { estado: 'pedido', fecha: today }; });
    onUpdateProject(project.id, { pafAccesos: next });
  };

  return (
    <section className="rounded-xl border border-orange-400/30 bg-orange-400/[0.04] p-3 space-y-3" aria-label="Presencia automática">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="flex-1 text-xs font-bold text-zinc-100">Presencia esta semana</h3>
        <span className="text-[11px] text-zinc-400">{semana ? `Semana ${semana} desde el ${inicio!.split('-').reverse().slice(0, 2).join('/')}` : 'Sin fecha de inicio'}</span>
      </div>

      {toca.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex-1 min-w-[12rem] text-[11px] text-zinc-200">Ya toca empezar <b>{toca.map((t) => t.titulo).join(', ')}</b>. Se cargan sus tareas (ocultas) y entregas{onAgendar ? ', y lo tuyo va a tu agenda con fecha' : ''}.</p>
          <button type="button" onClick={() => onEmpezar(toca)} className="inline-flex items-center gap-1 btn-solid-primary px-2.5 py-1 text-[11px]"><Play className="w-3 h-3" />Empezar {toca.length === 1 ? 'el tema' : `los ${toca.length}`}</button>
        </div>
      ) : semana ? <p className="text-[11px] text-zinc-400">Estás al día con lo que toca empezar. Las semanas son una referencia: acomodalas a lo que acordaste con el estudio.</p> : null}

      {sinAgenda.length > 0 && onAgendar && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex-1 min-w-[12rem] text-[11px] text-zinc-300">Lo tuyo de <b>{sinAgenda.map((t) => t.titulo).join(', ')}</b> todavía no está en tu agenda ({sinAgenda.reduce((n, t) => n + (TRABAJO_NUESTRO[t.id]?.length || 0), 0)} tareas).</p>
          <button type="button" onClick={() => onAgendar(sinAgenda)} className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-950"><CalendarCheck className="w-3 h-3" />Sumar a mi agenda</button>
        </div>
      )}

      {accesos.length > 0 && (
        <div className="space-y-1.5 border-t border-zinc-800 pt-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300"><KeyRound className="w-3.5 h-3.5 text-zinc-500" />Accesos <span className="font-normal text-zinc-500">· tocá para cambiar el estado</span></p>
          <div className="flex flex-wrap gap-1.5">
            {accesos.map((a) => {
              const e = estadoAcceso(project, a.id);
              return (
                <button key={a.id} type="button" onClick={() => siguiente(a.id)} title={a.como}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${CHIP[e.estado]}`}>
                  {a.label}: {ACCESO_ESTADO_LABEL[e.estado]}
                </button>
              );
            })}
          </div>
          {texto && (
            <div className="flex flex-wrap items-center gap-2">
              {project.clientPhone
                ? <a href={formatWhatsAppUrl(project.clientPhone, texto)} target="_blank" rel="noopener noreferrer" onClick={marcarPedidos} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300"><MessageCircle className="w-3 h-3" />Pedir {faltan.length === 1 ? 'el que falta' : `los ${faltan.length} que faltan`} por WhatsApp</a>
                : <button type="button" onClick={() => { navigator.clipboard?.writeText(texto).catch(() => undefined); marcarPedidos(); }} className="rounded-lg bg-zinc-800 px-2.5 py-1 text-[11px] font-bold text-zinc-200">Copiar el pedido de accesos</button>}
              <span className="text-[10px] text-zinc-500">Quedan como “pedido” y te aviso si no llegan en 5 días.</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
