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
    return 'bg-blue-600 text-white border-blue-600';
  }

  if (index === currentStep) {
    return 'bg-blue-600 text-white border-blue-600 ring-4 ring-blue-200 animate-pulse';
  }

  return 'bg-gray-200 text-gray-400 border-gray-200';
}

function getConnectorClasses(index: number, currentStep: number) {
  if (index < currentStep) {
    return 'bg-blue-600';
  }

  return 'bg-gray-200';
}

export function StepProgress({ currentStep }: StepProgressProps) {
  return (
    <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
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
                <p className="mt-2 hidden text-center text-xs font-medium text-gray-600 sm:block">{step.label}</p>
              </div>

              {index < STEPS.length - 1 ? (
                <div
                  className={[
                    'mt-5 h-1 w-full rounded-full transition-colors',
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
