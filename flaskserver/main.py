from flask import (
    Flask,
    redirect,
    url_for,
    request,
    render_template,
    Response,
    jsonify,
    redirect,
)
from PIL import Image
import numpy as np
from model import VGG19Embeddings

app = Flask(__name__)
model = VGG19Embeddings((256, 256, 3))


def model_predict(img, model):
    """
    Prediction Function for model.
    Arguments:
        img: is address to image
        model : image classification model
    """
    img = img.resize((256, 256))

    # Preprocessing the image
    x = np.array(img)
    x = np.expand_dims(x, axis=0)

    preds = model.get_embeddings(x)
    return preds


@app.route("/embeddings", methods=["POST"])
def embeddings():
    """
    get the embedding array of given image
    """
    if request.method == "POST":
        # Get the image from post request
        print(request)
        image = request.files["image"]
        img = Image.open(image)

        # Make prediction
        embds = model_predict(img, model)

        # convert numpy array to list
        embds = embds.ravel().tolist()
        # Serialize the result, you can add additional fields
        return jsonify(embeddings=embds)


if __name__ == "__main__":
    app.run()
