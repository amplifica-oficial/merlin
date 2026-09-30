import type {DescomplicandoTemplateRenderProps} from './types';

export function PuckDescomplicandoTemplateBlock({content: Content}: DescomplicandoTemplateRenderProps) {
  return (
    <div className="descomplicando-theme flex min-h-screen w-full min-w-0 flex-col items-stretch overflow-x-hidden scroll-smooth bg-[#020202] text-white">
      <Content />
    </div>
  );
}
