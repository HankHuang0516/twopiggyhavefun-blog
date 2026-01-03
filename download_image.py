import requests
import sys
import os

def download_jpg(url, output_path):
    """
    Downloads a JPG image from the given URL and saves it to the specified output path.

    Args:
        url (str): The URL of the JPG image.
        output_path (str): The full path and filename where the image will be saved.
    """
    try:
        # Send a GET request to the URL
        response = requests.get(url, stream=True)
        response.raise_for_status()  # Raise an HTTPError for bad responses (4xx or 5xx)

        # Ensure the directory exists
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir)

        # Open the file in binary write mode and save the content
        with open(output_path, 'wb') as file:
            for chunk in response.iter_content(chunk_size=8192):
                file.write(chunk)

        print(f"圖片已成功下載到: {output_path}")

    except requests.exceptions.RequestException as e:
        print(f"下載圖片時發生網路錯誤: {e}")
    except IOError as e:
        print(f"儲存圖片時發生檔案錯誤: {e}")
    except Exception as e:
        print(f"發生未知錯誤: {e}")

if __name__ == "__main__":
    # Check if the correct number of command-line arguments is provided
    if len(sys.argv) != 3:
        print("用法: python your_script_name.py <jpg_url> <output_path_with_filename>")
        print("範例: python download_image.py https://example.com/image.jpg ./downloads/my_image.jpg")
        sys.exit(1)

    jpg_url = sys.argv[1]
    output_file_path = sys.argv[2]

    download_jpg(jpg_url, output_file_path)