"""
Génération de QR Code (PNG encodé en Base64, data URL).

Equivalent Python de QrCodeService.java (qui utilisait ZXing) :
même format de sortie ("data:image/png;base64,..."), directement
utilisable dans une balise <img src="...">.
"""

import base64
from io import BytesIO

import qrcode

from app.models import Card, Member


def generate_qr_code(content: str) -> str:

    if not content or not content.strip():
        raise ValueError("Le contenu du QR Code ne peut pas être vide.")

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=1,
    )
    qr.add_data(content)
    qr.make(fit=True)

    image = qr.make_image(fill_color="black", back_color="white")
    image = image.resize((300, 300))

    buffer = BytesIO()
    image.save(buffer, format="PNG")

    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")

    return f"data:image/png;base64,{encoded}"


def build_qr_content(card: Card, member: Member) -> str:
    """Reproduit exactement le format de contenu utilisé par
    CardService.buildQrContent() côté Java."""

    def safe(value: str | None) -> str:
        return value or ""

    lines = [
        "JUDOCARD",
        f"Carte : {safe(card.card_number)}",
        f"Membre : {safe(member.first_name)} {safe(member.last_name)}",
        f"Téléphone : {safe(member.phone)}",
        f"Email : {safe(member.email)}",
        f"Ceinture : {member.belt or ''}",
        f"Sexe : {safe(member.sexe)}",
        f"Adresse : {safe(member.address)}",
    ]

    return "\n".join(lines)
