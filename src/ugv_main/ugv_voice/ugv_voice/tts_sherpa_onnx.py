import shlex
import numpy as np
import sherpa_onnx
import re
import soundfile as sf

class tts_sherpa_onnx:
    def __init__(self, model_dir):
        self.model_dir = model_dir
        self.lexicon_path = f"{model_dir}/lexicon.txt"
        self.tokens_path = f"{model_dir}/tokens.txt"
        self.dict_path = f"{model_dir}/dict"
        self.model_onnx_path = f"{model_dir}/model.onnx"        
        self.number_fst_path = f"{model_dir}/number.fst"
        self.tts_config = tts_config = sherpa_onnx.OfflineTtsConfig(
            model=sherpa_onnx.OfflineTtsModelConfig(
                vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                    model=self.model_onnx_path,
                    lexicon=self.lexicon_path,
                    data_dir='',
                    dict_dir=self.dict_path,
                    tokens=self.tokens_path,
                ),
                matcha=sherpa_onnx.OfflineTtsMatchaModelConfig(),
                kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(),
                provider='cpu',
                debug=False,
                num_threads=2,
            ),
            rule_fsts=self.number_fst_path,
            max_num_sentences=1,
        )
        self.tts_sess = sherpa_onnx.OfflineTts(self.tts_config)

    def synthesize(self, text, output_wav=None):
        audio = self.tts_sess.generate(text, sid=4, speed=1.0)
        scale = 4
        samples = np.array(audio.samples) * scale
        samples = np.clip(samples, -1.0, 1.0)

        if output_wav:
            sf.write(
                output_wav,
                samples,
                samplerate=audio.sample_rate,
                subtype="PCM_16",
            )
            return output_wav