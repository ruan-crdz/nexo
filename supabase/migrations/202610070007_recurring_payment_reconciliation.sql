create function public.reconcile_recurring_payment_for(owner uuid, rule_identifier uuid, occurrence_date date, paid_identifier uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare recurrence public.recurring_rules; occurrence public.recurring_occurrences;
 paid_record public.transactions; pending_record public.transactions;
begin
 perform pg_advisory_xact_lock(hashtextextended(owner::text,0));
 select * into recurrence from public.recurring_rules where id=rule_identifier and user_id=owner;
 if not found then raise exception 'recurrence ownership required';end if;
 perform pg_advisory_xact_lock(hashtext(rule_identifier::text));
 select * into occurrence from public.recurring_occurrences where rule_id=rule_identifier and due_date=occurrence_date for update;
 if not found or occurrence.transaction_id is null then raise exception 'occurrence unavailable';end if;
 select * into paid_record from public.transactions where id=paid_identifier and user_id=owner for update;
 if not found or paid_record.status<>'paid' or paid_record.type<>'expense' or recurrence.type<>'expense' then raise exception 'paid expense required';end if;
 if occurrence.transaction_id=paid_identifier then
  return jsonb_build_object('status','applied','repeated',true,'paid_id',paid_identifier,'no_transaction_created',true);
 end if;
 select * into pending_record from public.transactions where id=occurrence.transaction_id and user_id=owner for update;
 if not found or pending_record.status<>'planned' or pending_record.type<>'expense' then raise exception 'pending expense required';end if;
 if pending_record.external_id is distinct from 'recurring:'||rule_identifier::text||':'||occurrence_date::text then raise exception 'generated occurrence required';end if;
 if pending_record.amount<>paid_record.amount or lower(trim(pending_record.description))<>lower(trim(paid_record.description)) then raise exception 'payment does not match';end if;
 if (recurrence.frequency='monthly' and date_trunc('month',paid_record.date)<>date_trunc('month',occurrence_date))
 or (recurrence.frequency<>'monthly' and paid_record.date<>occurrence_date) then raise exception 'billing period mismatch';end if;
 if exists(select 1 from public.recurring_occurrences where transaction_id=paid_identifier and (rule_id<>rule_identifier or due_date<>occurrence_date)) then raise exception 'payment already linked';end if;
 update public.recurring_occurrences set transaction_id=paid_identifier where rule_id=rule_identifier and due_date=occurrence_date;
 delete from public.transactions where id=pending_record.id and user_id=owner and status='planned';
 return jsonb_build_object('status','applied','repeated',false,'paid_id',paid_identifier,'removed_pending_id',pending_record.id,'no_transaction_created',true);
end $$;
revoke all on function public.reconcile_recurring_payment_for(uuid,uuid,date,uuid) from public,anon,authenticated;
grant execute on function public.reconcile_recurring_payment_for(uuid,uuid,date,uuid) to service_role;

create function public.reconcile_recurring_payment(rule_identifier uuid,occurrence_date date,paid_identifier uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.session_assured() then raise exception 'authentication required';end if;
 return public.reconcile_recurring_payment_for(auth.uid(),rule_identifier,occurrence_date,paid_identifier);
end $$;
revoke all on function public.reconcile_recurring_payment(uuid,date,uuid) from public,anon;
grant execute on function public.reconcile_recurring_payment(uuid,date,uuid) to authenticated;