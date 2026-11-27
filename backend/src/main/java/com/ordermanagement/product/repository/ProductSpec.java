package com.ordermanagement.product.repository;

import com.ordermanagement.product.entity.Category;
import com.ordermanagement.product.entity.Product;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.util.*;

/**
 * Precision JPA Specifications for product search & filtering:
 *  - Tight, domain-accurate synonym groups (no unrelated cross-category leakage)
 *  - AND across distinct query tokens, OR within each token's true synonyms
 *  - Word-boundary matching for short tokens (<= 3 chars) so "pen" doesn't match "open"
 *    and "mat" doesn't match "material" or "automatic"
 *  - Price filters compare against effective discounted price
 */
public class ProductSpec {

    private static final Set<String> STOP_WORDS = Set.of(
            "a", "an", "the", "for", "of", "in", "on", "to", "with", "and", "or", "by", "from",
            "ka", "ki", "ke", "ko", "se", "mein", "me", "wala", "wali", "wale", "achha", "accha", "badhiya", "sasta", "saste"
    );

    /** Common Hinglish (Hindi-in-Latin) e-commerce terms mapped to canonical English product words. */
    private static final Map<String, String> HINGLISH_MAP = Map.ofEntries(
            // Footwear
            Map.entry("juta", "shoes"), Map.entry("joota", "shoes"), Map.entry("jute", "shoes"),
            Map.entry("joote", "shoes"), Map.entry("jootey", "shoes"), Map.entry("jutey", "shoes"),
            Map.entry("chappal", "sandals"), Map.entry("chapal", "sandals"), Map.entry("chappals", "sandals"),
            // Watches
            Map.entry("ghadi", "watch"), Map.entry("ghari", "watch"), Map.entry("ghadiya", "watch"),
            // Eyewear
            Map.entry("chashma", "sunglasses"), Map.entry("chasma", "sunglasses"), Map.entry("ainak", "sunglasses"),
            // Clothing
            Map.entry("kapda", "clothing"), Map.entry("kapde", "clothing"), Map.entry("kapdey", "clothing"),
            Map.entry("kameez", "shirt"), Map.entry("kamiz", "shirt"), Map.entry("kurta", "shirt"),
            Map.entry("pajama", "trousers"), Map.entry("patloon", "trousers"),
            // Bags & Wallets
            Map.entry("batua", "wallet"), Map.entry("batuwa", "wallet"), Map.entry("pars", "wallet"),
            Map.entry("basta", "backpack"), Map.entry("thaila", "bag"), Map.entry("jhola", "bag"), Map.entry("peti", "luggage"),
            Map.entry("kamarband", "belt"),
            // Audio & Tech
            Map.entry("fon", "phone"), Map.entry("mobail", "phone"), Map.entry("baaja", "speaker"),
            // Home & Kitchen
            Map.entry("takiya", "pillow"), Map.entry("takiye", "pillow"),
            Map.entry("chadar", "bedsheet"), Map.entry("chaddar", "bedsheet"), Map.entry("bistar", "bedsheet"),
            Map.entry("chaku", "knife"), Map.entry("chhuri", "knife"), Map.entry("churi", "knife"),
            Map.entry("kadhai", "skillet"), Map.entry("tawa", "skillet"), Map.entry("bartan", "dinnerware"),
            Map.entry("ketli", "kettle"), Map.entry("chai", "kettle"), Map.entry("kofi", "coffee"),
            Map.entry("roshni", "lamp"), Map.entry("batti", "lamp"),
            Map.entry("jhadoo", "vacuum"), Map.entry("jhadu", "vacuum"),
            Map.entry("pankha", "cooler"), Map.entry("thanda", "cooler"),
            // Sports & Fitness
            Map.entry("botal", "bottle"), Map.entry("paani", "bottle"), Map.entry("pani", "bottle"),
            Map.entry("dumble", "dumbbell"), Map.entry("dambal", "dumbbell"),
            Map.entry("saikil", "bicycle"), Map.entry("saikal", "bicycle"),
            Map.entry("rassi", "rope"), Map.entry("kasrat", "fitness"), Map.entry("vyayam", "fitness"),
            // Beauty & Personal Care
            Map.entry("itra", "perfume"), Map.entry("attar", "perfume"), Map.entry("khushboo", "perfume"), Map.entry("khushbu", "perfume"),
            Map.entry("tel", "oil"), Map.entry("baal", "hair"),
            Map.entry("sabun", "cleanser"), Map.entry("chehra", "skincare"), Map.entry("twacha", "skincare"),
            Map.entry("dadhi", "trimmer"), Map.entry("daant", "toothbrush")
    );

    private static final List<Set<String>> SYNONYM_GROUPS = List.of(
            Set.of("shoe", "shoes", "sneaker", "sneakers", "boot", "boots", "footwear", "sandal", "sandals", "slipper", "slippers", "loafer", "loafers", "trainer", "trainers"),
            Set.of("phone", "phones", "mobile", "mobiles", "smartphone", "smartphones", "cellphone", "handset"),
            Set.of("headphone", "headphones", "earphone", "earphones", "earbud", "earbuds", "airpod", "airpods", "headset", "headsets"),
            Set.of("speaker", "speakers", "soundbar", "subwoofer"),
            Set.of("laptop", "laptops", "macbook", "ultrabook", "notebook"),
            Set.of("watch", "watches", "smartwatch", "smartwatches", "wristwatch", "timepiece"),
            Set.of("sunglass", "sunglasses", "eyewear", "shades", "glasses"),
            Set.of("shirt", "shirts", "tshirt", "tshirts", "polo", "tee"),
            Set.of("hoodie", "hoodies", "sweatshirt", "sweatshirts", "sweater", "pullover"),
            Set.of("jacket", "jackets", "blazer", "blazers", "puffer", "coat"),
            Set.of("jean", "jeans", "denim", "trouser", "trousers", "chino", "chinos", "pant", "pants"),
            Set.of("bag", "bags", "backpack", "backpacks", "rucksack", "duffel", "trolley", "luggage", "suitcase", "messenger"),
            Set.of("coffee", "espresso", "carafe", "kettle"),
            Set.of("bottle", "bottles", "flask", "flasks"),
            Set.of("lamp", "lamps", "lighting"),
            Set.of("keyboard", "keyboards"),
            Set.of("mouse", "mice"),
            Set.of("monitor", "monitors", "display"),
            Set.of("camera", "cameras", "vlogging"),
            Set.of("console", "playstation", "ps5", "nintendo", "switch"),
            Set.of("serum", "cleanser", "sunscreen", "lotion", "skincare", "moisturizer"),
            Set.of("perfume", "parfum", "fragrance", "cologne"),
            Set.of("dumbbell", "dumbbells", "kettlebell", "kettlebells", "weights"),
            Set.of("bicycle", "bike", "cycle")
    );

    private ProductSpec() {}

    public static Set<String> getAllSynonymWords() {
        Set<String> words = new LinkedHashSet<>();
        for (Set<String> group : SYNONYM_GROUPS) {
            words.addAll(group);
        }
        words.addAll(HINGLISH_MAP.keySet());
        return words;
    }

    public static Specification<Product> withFilters(
            Long categoryId,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            String search,
            Boolean active) {

        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            Join<Product, Category> categoryJoin = root.join("category", JoinType.LEFT);

            if (categoryId != null) {
                predicates.add(cb.equal(categoryJoin.get("id"), categoryId));
            }

            // Effective price = price * (1 - discountPercent / 100)
            Expression<BigDecimal> hundred = cb.literal(BigDecimal.valueOf(100));
            Expression<BigDecimal> effectivePrice = cb.quot(
                    cb.prod(root.get("price"), cb.diff(hundred, cb.coalesce(root.get("discountPercent"), BigDecimal.ZERO))),
                    hundred
            ).as(BigDecimal.class);

            if (minPrice != null) {
                predicates.add(cb.greaterThanOrEqualTo(effectivePrice, minPrice));
            }

            if (maxPrice != null) {
                predicates.add(cb.lessThanOrEqualTo(effectivePrice, maxPrice));
            }

            if (search != null && !search.isBlank()) {
                List<Set<String>> tokenGroups = buildTokenSynonymGroups(search);
                Expression<String> lowerName = cb.lower(root.get("name"));
                Expression<String> lowerDesc = cb.lower(cb.coalesce(root.get("description"), ""));
                Expression<String> lowerCat  = cb.lower(cb.coalesce(categoryJoin.get("name"), ""));

                // Each token in the query must match (AND), using any of its own synonyms (OR)
                for (Set<String> group : tokenGroups) {
                    List<Predicate> synonymPredicates = new ArrayList<>();
                    for (String term : group) {
                        if (term.length() <= 3) {
                            // Whole-word match for short tokens so "pen" != "open", "mat" != "material"
                            Expression<String> paddedName = cb.concat(cb.concat(" ", lowerName), " ");
                            Expression<String> paddedDesc = cb.concat(cb.concat(" ", lowerDesc), " ");
                            String wordPattern = "% " + term + " %";
                            synonymPredicates.add(cb.or(
                                    cb.like(paddedName, wordPattern),
                                    cb.like(paddedDesc, wordPattern),
                                    cb.equal(lowerName, term)
                            ));
                        } else {
                            String pattern = "%" + term + "%";
                            synonymPredicates.add(cb.or(
                                    cb.like(lowerName, pattern),
                                    cb.like(lowerDesc, pattern),
                                    cb.like(lowerCat, pattern)
                            ));
                        }
                    }
                    if (!synonymPredicates.isEmpty()) {
                        predicates.add(cb.or(synonymPredicates.toArray(new Predicate[0])));
                    }
                }
            }

            if (active != null) {
                predicates.add(cb.equal(root.get("active"), active));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private static List<Set<String>> buildTokenSynonymGroups(String search) {
        List<Set<String>> groups = new ArrayList<>();
        String[] rawTokens = search.trim().toLowerCase().split("[^a-z0-9]+");

        for (String raw : rawTokens) {
            if (raw.isEmpty() || STOP_WORDS.contains(raw)) continue;

            // Translate Hinglish words (e.g. juta -> shoes, chappal -> sandals, ghadi -> watch)
            String translated = HINGLISH_MAP.getOrDefault(raw, raw);

            Set<String> expanded = new LinkedHashSet<>();
            expanded.add(translated);

            String stem = translated;
            if (translated.length() > 4 && translated.endsWith("es")) {
                stem = translated.substring(0, translated.length() - 2);
                expanded.add(stem);
            } else if (translated.length() > 3 && translated.endsWith("s")) {
                stem = translated.substring(0, translated.length() - 1);
                expanded.add(stem);
            }

            for (Set<String> synGroup : SYNONYM_GROUPS) {
                if (synGroup.contains(translated) || synGroup.contains(stem)) {
                    expanded.addAll(synGroup);
                }
            }
            groups.add(expanded);
        }
        return groups;
    }
}
