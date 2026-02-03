import os
import urllib.request
import tarfile
import sys

def report_progress(block_num, block_size, total_size):
    if total_size > 0:
        percent = min(100, (block_num * block_size * 100) / total_size)
        sys.stdout.write(f"\rDownloading: {percent:.1f}%")
        sys.stdout.flush()

def download_url(url, output_path):
    print(f"Downloading {url.split('/')[-1]}...")
    urllib.request.urlretrieve(url, filename=output_path, reporthook=report_progress)
    print("\nDownload complete.")

def download_and_extract(url, target_dir):
    filename = url.split("/")[-1]
    filepath = os.path.join(target_dir, filename)
    
    if not os.path.exists(target_dir):
        os.makedirs(target_dir)
        
    if not os.path.exists(filepath):
        download_url(url, filepath)
    else:
        print(f"{filename} already exists. Skipping download.")

    print(f"Extracting {filename}...")
    with tarfile.open(filepath) as tar:
        tar.extractall(path=target_dir)
    print("Done.")

def main():
    # Model: sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20
    # A small, fast streaming ASR model for Chinese and English
    base_url = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20.tar.bz2"
    target_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "local_sherpa_onnx_models")
    
    download_and_extract(base_url, target_dir)

if __name__ == "__main__":
    main()
