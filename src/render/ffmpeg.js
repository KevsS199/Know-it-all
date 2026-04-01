import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';

ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH || ffmpegInstaller.path);
ffmpeg.setFfprobePath(process.env.FFPROBE_PATH || ffprobeInstaller.path);

function getAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
}

function makeClip(visual, audioPath, outputPath, duration) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg();

    if (visual?.type === 'sequence') {
      command.input(visual.pattern).inputOptions([`-framerate ${visual.fps}`, '-stream_loop -1']);
    } else {
      command.input(visual).inputOptions(['-loop 1']);
    }

    command
      .input(audioPath)
      .outputOptions([
        '-c:v libx264',
        '-c:a aac',
        '-b:a 192k',
        '-pix_fmt yuv420p',
        '-r 30',
        `-t ${duration}`,
        '-shortest',
        '-movflags +faststart',
      ])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

function concatenateClips(clipPaths, outputPath) {
  return new Promise(async (resolve, reject) => {
    const listPath = outputPath.replace('.mp4', '_concat.txt');
    const listContent = clipPaths.map((path) => `file '${path.replace(/\\/g, '/')}'`).join('\n');
    await writeFile(listPath, listContent);

    ffmpeg()
      .input(listPath)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions([
        '-c:v libx264',
        '-c:a aac',
        '-pix_fmt yuv420p',
        '-movflags +faststart',
      ])
      .output(outputPath)
      .on('end', async () => {
        await unlink(listPath).catch(() => {});
        resolve();
      })
      .on('error', reject)
      .run();
  });
}

export async function renderVideo(framePaths, audioPaths, outputPath, tmpDir) {
  const pairs = [
    { visual: framePaths.hook, audio: audioPaths.hook },
    ...framePaths.segments.map((visual, index) => ({
      visual,
      audio: audioPaths[`segment_${index + 1}`],
    })),
    { visual: framePaths.cta, audio: audioPaths.cta },
  ];

  const clipPaths = [];

  for (let i = 0; i < pairs.length; i++) {
    const { visual, audio } = pairs[i];
    const clipPath = join(tmpDir, `clip_${i}.mp4`);

    const duration = await getAudioDuration(audio);
    const paddedDuration = duration + 0.4;

    console.log(`[ffmpeg] Clip ${i + 1}/${pairs.length} - ${paddedDuration.toFixed(2)}s`);
    await makeClip(visual, audio, clipPath, paddedDuration);
    clipPaths.push(clipPath);
  }

  console.log(`[ffmpeg] Concatenating ${clipPaths.length} clips -> ${outputPath}`);
  await concatenateClips(clipPaths, outputPath);

  await Promise.all(clipPaths.map((path) => unlink(path).catch(() => {})));
  console.log(`[ffmpeg] Done: ${outputPath}`);
}
