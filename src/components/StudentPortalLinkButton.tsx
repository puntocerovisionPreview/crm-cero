import React, { useState } from 'react';
import { Link2, Check, ExternalLink, MessageCircle, Ban } from 'lucide-react';
import { Project } from '../types';
import { hapticFeedback } from '../utils/haptics';
import { formatWhatsAppUrl } from '../utils/contact';
import { generatePortalToken, getStudentPortalUrl, unpublishStudentPortal } from '../utils/studentPortal';
import { relinkPortalPanel } from '../panels/store';

interface Props {
  project: Project;
  phone?: string;
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
}

// Genera, copia, comparte o desactiva el link de solo lectura del alumno PAF
export const StudentPortalLinkButton: React.FC<Props> = ({ project, phone, onUpdateProject }) => {
  const [copied, setCopied] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const token = project.studentPortalToken;
  const url = token ? getStudentPortalUrl(token) : '';

  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copiá el link del alumno:', link);
    }
  };

  const handleCreate = () => {
    hapticFeedback.success();
    const newToken = generatePortalToken();
    // App publica la foto del alumno automáticamente al ver el token nuevo
    onUpdateProject(project.id, { studentPortalToken: newToken });
    // Si tiene panel (objetivos, tareas, contenido), pasa al link nuevo
    relinkPortalPanel(project.id, newToken).catch((err) => console.warn(err));
    copy(getStudentPortalUrl(newToken));
  };

  const handleDisable = () => {
    if (!token) return;
    hapticFeedback.medium();
    unpublishStudentPortal(token).catch((err) => console.warn(err));
    onUpdateProject(project.id, { studentPortalToken: '' });
    relinkPortalPanel(project.id, '').catch((err) => console.warn(err));
    setConfirmDisable(false);
  };

  if (!token) {
    return (
      <button
        onClick={handleCreate}
        className="w-full flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition active:scale-95"
        title="El cliente entra sin contraseña y ve su programa, tareas, contenido y sesiones"
      >
        <Link2 className="w-3.5 h-3.5 text-amber-400" />
        <span>Crear enlace del programa PAF</span>
      </button>
    );
  }

  const whatsappText = `¡Hola ${project.clientName}! Este es tu espacio del Método PAF: vas a encontrar el plan de los tres meses, tus pendientes, el contenido para revisar y las sesiones. Entrás directamente, sin contraseña: ${url}`;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-2 space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-400">
        <Link2 className="w-3 h-3 text-amber-400" />
        <span>Enlace del programa activo · sin contraseña</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={() => {
            hapticFeedback.light();
            copy(url);
          }}
          className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-bold transition active:scale-95"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link2 className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copiado' : 'Copiar'}</span>
        </button>
        {phone ? (
          <a
            href={formatWhatsAppUrl(phone, whatsappText)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => hapticFeedback.light()}
            className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-[11px] font-bold transition active:scale-95"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Enviar</span>
          </a>
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-bold transition active:scale-95"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Ver</span>
          </a>
        )}
        <button
          onClick={() => (confirmDisable ? handleDisable() : setConfirmDisable(true))}
          onBlur={() => setConfirmDisable(false)}
          className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold transition active:scale-95 ${
            confirmDisable ? 'bg-red-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
          }`}
          title="El link actual deja de funcionar"
        >
          <Ban className="w-3.5 h-3.5" />
          <span>{confirmDisable ? '¿Seguro?' : 'Desactivar'}</span>
        </button>
      </div>
    </div>
  );
};
