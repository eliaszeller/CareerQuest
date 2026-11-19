"""Starter mapping from survey career categories to O*NET-SOC code prefixes.

Major groups follow the 2018 SOC. "Political" has no SOC major group, so it lists
specific occupations. Review this mapping with the team before relying on it.
"""

CATEGORY_SOC_PREFIXES: dict[str, tuple[str, ...]] = {
    "Healthcare": ("29-", "31-"),
    "Business": ("11-", "13-", "41-", "43-"),
    "Education": ("25-",),
    "Military": ("55-",),
    "Law": ("23-",),
    "Trades": ("47-", "49-", "51-"),
    "Political": ("11-1031", "19-3094", "11-9161", "13-1041", "21-1099"),
}
