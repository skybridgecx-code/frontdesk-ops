'use client';

interface StepProgressProps {
  currentStep: number;
}

const STEPS = [
  { label: 'Business Info', icon: '🏢' },
  { label: 'AI Greeting', icon: '💬' },
  { label: 'Phone Number', icon: '📞' },
  { label: 'All Done', icon: '🎉' }
];

function getStepClasses(index: number, currentStep: number) {
  if (index < currentStep) {
    return 'bg-[#00d4ff] text-[#020305] border-[#00d4ff]';
  }

  if (index === currentStep) {
    return 'bg-[#00d4ff] text-[#020305] border-[#00d4ff] shadow-[0_0_0_4px_rgba(0,212,255,0.18)]';
  }

  return 'bg-[#080c12] text-[#5a6a80] border-white/10';
}

function getConnectorClasses(index: number, currentStep: number) {
  if (index < currentStep) {
    return 'bg-[#00d4ff]';
  }

  return 'bg-white/10';
}

export function StepProgress({ currentStep }: StepProgressProps) {
  return (
    <div className="mb-8 rounded-2xl border border-white/10 bg-[#0d1320] p-4 shadow-[0_30px_60px_rgba(0,0,0,0.4)] sm:p-6">
      <div className="flex items-start justify-between gap-2">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentStep;

          return (
            <div key={step.label} className="flex flex-1 items-center">
              <div className="flex w-full flex-col items-center">
                <div
                  className={[
                    'flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition-all',
                    getStepClasses(index, currentStep)
                  ].join(' ')}
                >
                  {isCompleted ? '✓' : <span aria-hidden="true">{step.icon}</span>}
                </div>
                <p className="mt-2 hidden text-center font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5a6a80] sm:block">
                  {step.label}
                </p>
              </div>

              {index < STEPS.length - 1 ? (
                <div
                  className={[
                    'mt-5 h-[2px] w-full rounded-full transition-colors',
                    getConnectorClasses(index, currentStep)
                  ].join(' ')}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
