import { extractCallData } from './call-extraction.js';

async function main() {
  const result = await extractCallData({
    callerTranscript:
      'Hi, my name is John Smith. My AC stopped working this morning at 123 Main Street in Reston. You can call me back at 571-324-0674. I need someone out today if possible.',
    assistantTranscript:
      'Thanks, John. I understand your AC stopped working today at 123 Main Street in Reston, and you would like a callback at 571-324-0674 with service as soon as possible.'
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
