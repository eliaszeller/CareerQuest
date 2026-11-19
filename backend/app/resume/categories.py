"""Resume Dataset categories mapped to display labels and starter O*NET-SOC codes.

The Resume Dataset (Resume.csv) labels each resume with one of 24 categories. Codes not
present in the local O*NET build are dropped at runtime; review this mapping with the team.
"""

CATEGORY_MAP: dict[str, tuple[str, tuple[str, ...]]] = {
    "ACCOUNTANT": ("Accounting", ("13-2011.00",)),
    "ADVOCATE": ("Law and advocacy", ("23-1011.00", "23-2011.00")),
    "AGRICULTURE": ("Agriculture", ("11-9013.00", "19-4012.00")),
    "APPAREL": ("Apparel and fashion", ("27-1022.00",)),
    "ARTS": ("Arts", ("27-1013.00",)),
    "AUTOMOBILE": ("Automotive", ("49-3023.00",)),
    "AVIATION": ("Aviation", ("53-2011.00", "49-3011.00")),
    "BANKING": ("Banking", ("13-2072.00", "43-3071.00")),
    "BPO": ("Customer support operations", ("43-4051.00",)),
    "BUSINESS-DEVELOPMENT": ("Business development", ("11-2022.00", "13-1161.00")),
    "CHEF": ("Culinary", ("35-1011.00",)),
    "CONSTRUCTION": ("Construction", ("11-9021.00", "47-2061.00")),
    "CONSULTANT": ("Consulting", ("13-1111.00",)),
    "DESIGNER": ("Design", ("27-1024.00", "27-1021.00")),
    "DIGITAL-MEDIA": ("Digital media", ("27-1014.00", "13-1161.01")),
    "ENGINEERING": ("Engineering", ("17-2141.00", "17-2051.00")),
    "FINANCE": ("Finance", ("13-2051.00", "11-3031.00")),
    "FITNESS": ("Fitness", ("39-9031.00",)),
    "HEALTHCARE": ("Healthcare", ("29-1141.00", "11-9111.00")),
    "HR": ("Human resources", ("13-1071.00", "11-3121.00")),
    "INFORMATION-TECHNOLOGY": ("Information technology",
                               ("15-1232.00", "15-1244.00", "11-3021.00")),
    "PUBLIC-RELATIONS": ("Public relations", ("27-3031.00",)),
    "SALES": ("Sales", ("41-4012.00", "41-2031.00")),
    "TEACHER": ("Teaching", ("25-2021.00", "25-2031.00")),
}


def display_label(category: str) -> str:
    return CATEGORY_MAP.get(category, (category.replace("-", " ").title(), ()))[0]


def mapped_socs(category: str) -> tuple[str, ...]:
    return CATEGORY_MAP.get(category, ("", ()))[1]
