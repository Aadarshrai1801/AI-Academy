import {
  escapeDrawtext,
  narrationDuration,
  splitAnswerToScenes,
  totalDuration,
} from './script.js';

describe('explainer script helpers', () => {
  it('paces scenes by narration length within bounds', () => {
    expect(narrationDuration('one two three')).toBe(4); // floor
    expect(narrationDuration(Array.from({ length: 600 }, () => 'word').join(' '))).toBe(20);
  });

  it('splits an answer into narrated scenes covering the text', () => {
    const script = splitAnswerToScenes(
      'What is overfitting in machine learning?',
      'Overfitting happens when a model memorizes noise. The train-test gap grows large. ' +
        'Fix it with regularization, more data, or early stopping. Cross-validation detects it early. ' +
        'Simpler models often generalize better than huge ones.',
    );
    expect(script.scenes.length).toBeGreaterThanOrEqual(2);
    expect(script.scenes.length).toBeLessThanOrEqual(5);
    expect(totalDuration(script)).toBeGreaterThan(0);
    for (const s of script.scenes) {
      expect(s.narration.length).toBeGreaterThan(0);
      expect(s.bullets.length).toBeGreaterThan(0);
    }
  });

  it('escapes ffmpeg drawtext metacharacters', () => {
    expect(escapeDrawtext("it's 100%: C:\\path")).toBe("it\\'s 100\\%\\: C\\:\\\\path");
  });
});
