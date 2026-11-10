# Regenera supabase/esquema/ a partir de la "foto" de la base (CSV exportado desde historial/46_foto_base_SOLO_LECTURA.sql).
# Uso:  python supabase/herramientas/armar_esquema.py foto_base.csv supabase/esquema
# Separa cada objeto en su archivo (00 a 06) y ordena las vistas según de qué otras vistas dependen.
import csv,re,sys,pathlib
src,out=sys.argv[1],pathlib.Path(sys.argv[2]); out.mkdir(parents=True,exist_ok=True)
r=list(csv.DictReader(open(src,encoding='utf-8')))
# los 'constraint trigger' aparecen también como restricción: se crean en 04_triggers
r=[x for x in r if not (x['tipo']=='restriccion' and re.search(r' TRIGGER( |;)', x['definicion']))]
def de(t,pred=lambda x:True): return [x for x in r if x['tipo']==t and pred(x)]
import datetime
FECHA=datetime.date.today().strftime('%d/%m/%Y')
def cab(n,titulo,texto):
  return f"""-- {n} · {titulo}
-- Foto de la base de producción de FOSAN tomada el {FECHA} (generado desde la base real, no a mano).
{texto}
-- Orden para montar una base nueva: 00 → 01 → 02 → 03 → 04 → 05 → 06 (ver supabase/README.md).

"""
def bloque(titulo, filas, sep='\n\n'):
  if not filas: return ''
  return f"-- ═══ {titulo} ({len(filas)}) ═══\n\n" + sep.join(x['definicion'].strip() for x in filas) + '\n\n'
def w(nombre,txt): (out/nombre).write_text(txt.replace('\r\n','\n'),encoding='utf-8'); print(nombre, len(txt))

# 00
ext=[dict(x, definicion=x['definicion']) for x in de('extension')]
w('00_extensiones_tipos.sql', cab('00','Extensiones, tipos (listas de valores) y secuencias',
 '-- Los "tipos" son las listas cerradas de valores (estado de un equipo, rol, tipo de servicio...).\n-- Las secuencias generan los folios y códigos correlativos (D-0001, M-0001, códigos de cliente...).')
 + bloque('Extensiones de Postgres', de('extension'), '\n')
 + bloque('Tipos', de('tipo'), '\n')
 + bloque('Secuencias', de('secuencia'), '\n'))
# 01
w('01_tablas.sql', cab('01','Tablas, claves, relaciones e índices',
 '-- Primero se crean todas las tablas; después sus claves y validaciones; al final las relaciones entre tablas\n-- (así el orden de creación no importa) y los índices de búsqueda.')
 + bloque('Tablas', de('tabla'))
 + bloque('Claves primarias, únicas y validaciones', [x for x in r if x['tipo']=='restriccion' and x['orden']=='5'], '\n')
 + bloque('Relaciones entre tablas (claves foráneas)', [x for x in r if x['tipo']=='restriccion' and x['orden']=='6'], '\n')
 + bloque('Índices', de('indice'), '\n'))
# 02
w('02_funciones.sql', cab('02','Funciones (reglas de negocio, permisos y acciones de la app)',
 '-- La app llama a estas funciones con supabase.rpc(...). Las "security definer" corren con permisos del dueño de la base\n-- y validan por dentro quién puede usarlas (es_dueno(), permiso_seccion(), es_operador()...).')
 + 'set check_function_bodies = off;   -- algunas funciones usan vistas que se crean en 03\n\n'
 + bloque('Funciones', de('funcion')))
# 03 vistas en orden de dependencia
vs=de('vista'); nom={x['nombre'] for x in vs}; hechas=[]; pend=list(vs)
while pend:
  for x in pend:
    usa={n for n in nom if n!=x['nombre'] and re.search(r'\b'+n+r'\b', x['definicion'])}
    if usa <= {h['nombre'] for h in hechas}: hechas.append(x); pend.remove(x); break
  else: raise SystemExit('ciclo en vistas')
w('03_vistas.sql', cab('03','Vistas (consultas guardadas que usan las pantallas y los reportes)',
 '-- Ordenadas por dependencia: una vista que usa otra va después.\n-- security_invoker=on: la vista respeta las reglas de seguridad de quien consulta (ver script historial 42).')
 + bloque('Vistas', hechas))
# 04
w('04_triggers.sql', cab('04','Triggers (reglas automáticas al guardar)',
 '-- Se ejecutan solos al insertar/actualizar: folios, MAYÚSCULAS, validaciones de fechas, auditoría,\n-- orden de mantenimiento obligatoria, creación del perfil al crear un usuario (auth.users), etc.')
 + bloque('Triggers', de('trigger'), '\n'))
# 05
pub=de('politica',lambda x:x['nombre'].startswith('public.'))
w('05_seguridad.sql', cab('05','Seguridad: RLS, reglas por rol y permisos',
 '-- RLS = seguridad por filas: cada tabla solo muestra/permite lo que sus reglas (políticas) dicen.\n-- Reglas "permissive" suman acceso; "restrictive" (op_limite) lo recortan: el operador solo ve lo de su ruta.\n-- El acceso anónimo (sin iniciar sesión) a tablas y vistas está cerrado (ver historial 40).')
 + bloque('Seguridad por filas activada', de('rls'), '\n')
 + bloque('Reglas (políticas) de las tablas', pub, '\n')
 + '-- ═══ Acceso anónimo cerrado a tablas y vistas ═══\n\nrevoke select, insert, update, delete, truncate, references, trigger on all tables in schema public from anon;\nalter default privileges in schema public revoke all on tables from anon;\n\n'
 + bloque('Funciones que hoy puede ejecutar el rol anon (permiso por defecto de Supabase)', de('permiso'), '\n'))
# 06
w('06_storage.sql', cab('06','Archivos (Storage): carpeta "fosan"',
 '-- Fotos y firmas de respaldos de operaciones, documentos, etc. Lectura: usuarios con acceso; escritura: dueño;\n-- respaldos: los sube quien realiza la operación.')
 + bloque('Bucket', de('bucket'), '\n')
 + bloque('Reglas de Storage', de('politica',lambda x:x['nombre'].startswith('storage.')), '\n'))
tot=sum(1 for _ in r); print('filas',tot)
