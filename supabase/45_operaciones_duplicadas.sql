-- 45 · ESTANDARIZACIÓN · Paquete 22: un baño no puede estar en dos entregas ni en dos retiros programados a la vez.
--   Hoy se puede programar dos veces el retiro del mismo baño (Dora 20b-2) y, al realizar uno, el otro queda colgado.
--   A. Regla en la base: al agregar un baño a una operación, si ya está en otra operación PROGRAMADA con la misma acción → error.
--   B. Limpieza: se cancelan los duplicados que ya existen (queda el más antiguo) y los retiros de baños que ya no están en ese cliente.


-- ══ PASO 1 · Cambios (seleccionar hasta el PASO 3) ══════════════════════════════
begin;

-- B1. Duplicados: queda la operación más antigua; las demás se cancelan con motivo
with dup as (
  select d.id, row_number() over (partition by db.activo_id, db.accion order by d.creado_en, d.folio) as n
    from despacho_banos db join despachos d on d.id = db.despacho_id
   where d.estado = 'programado'
)
update despachos x set estado = 'cancelado', cancelado_en = now(),
       motivo_cancelacion = 'Duplicada: el baño ya estaba en otra operación programada (limpieza paquete 22)'
 where x.id in (select id from dup where n > 1) and x.estado = 'programado'
   -- solo si TODOS sus baños están repetidos en otra operación (no se cancela una operación con baños propios)
   and not exists (select 1 from despacho_banos db2
                    where db2.despacho_id = x.id
                      and not exists (select 1 from despacho_banos db3 join despachos d3 on d3.id = db3.despacho_id
                                       where db3.activo_id = db2.activo_id and db3.accion = db2.accion
                                         and d3.estado = 'programado' and d3.id <> x.id and d3.creado_en <= x.creado_en));

-- B2. Retiros de baños que ya no están en ese cliente
update despachos x set estado = 'cancelado', cancelado_en = now(),
       motivo_cancelacion = 'Sin baños que retirar: ya se retiraron con otra operación (limpieza paquete 22)'
 where x.estado = 'programado' and x.tipo = 'retiro'
   and exists (select 1 from despacho_banos db where db.despacho_id = x.id and db.accion = 'retiro')
   and not exists (select 1 from despacho_banos db join activos a on a.id = db.activo_id
                    where db.despacho_id = x.id and db.accion = 'retiro' and a.cliente_id is not distinct from x.cliente_id);

-- A. Regla: un baño no se repite en operaciones programadas con la misma acción
create or replace function validar_bano_unico() returns trigger as $$
declare otra record; cod text;
begin
  select d.folio, d.tipo into otra
    from despacho_banos db join despachos d on d.id = db.despacho_id
   where db.activo_id = new.activo_id and db.accion = new.accion and d.estado = 'programado' and db.despacho_id <> new.despacho_id
   limit 1;
  if otra.folio is not null then
    select codigo into cod from activos where id = new.activo_id;
    raise exception 'El baño % ya está en la operación % (programada) con % pendiente. Edita o cancela esa operación.',
      cod, otra.folio, case when new.accion = 'retiro' then 'su retiro' else 'su entrega' end;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists t_bano_unico on despacho_banos;
create trigger t_bano_unico before insert or update on despacho_banos for each row execute function validar_bano_unico();

commit;

