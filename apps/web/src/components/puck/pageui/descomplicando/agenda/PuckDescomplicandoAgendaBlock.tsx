import type {DescomplicandoAgendaProps} from './types';

export function PuckDescomplicandoAgendaBlock({
  title,
  bulletOne,
  bulletTwo,
  invite,
}: DescomplicandoAgendaProps) {
  return (
    <section className="bg-[#DA4C5C] p-[5%] text-white">
      <div className="mx-auto w-full max-w-[1140px]">
        <h2 className="text-[25px] font-semibold md:text-[30px]">{title}</h2>
        <div className="mt-4 space-y-4 text-[16px] font-normal md:text-[18px] lg:text-[20px]">
          <p>{bulletOne}</p>
          <p>{bulletTwo}</p>
          <p>{invite}</p>
        </div>
      </div>
    </section>
  );
}
