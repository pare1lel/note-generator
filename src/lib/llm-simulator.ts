import { WordAnnotation, SentenceAnnotation, StyleReport } from "./types";

// Simulated LLM responses with realistic delays
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Dictionary of common word definitions for demo
const wordDefinitions: Record<string, { literal: { en: string; zh: string }; contextual: { en: string; zh: string } }> = {
  reading: {
    literal: {
      en: "The action or practice of interpreting written matter to acquire information or meaning.",
      zh: "解释书面材料以获取信息或意义的行动或实践。",
    },
    contextual: {
      en: "In this passage, 'reading' refers not merely to decoding text but to the active, transformative process of engaging with literature that shapes one's understanding and worldview.",
      zh: "在这段文字中，'阅读'不仅指解码文本，而是指积极参与文学的过程，这种参与能够塑造一个人的理解和世界观。",
    },
  },
  journey: {
    literal: {
      en: "An act of traveling from one place to another; a long and uneven process.",
      zh: "从一地到另一地的旅行行为；漫长而不平坦的过程。",
    },
    contextual: {
      en: "Metaphorically, 'journey' suggests that reading is not a destination but a continuous process of discovery and transformation, implying both effort and reward.",
      zh: "隐喻性地，'旅程'表明阅读不是一个目的地，而是一个持续的发现和转变过程，暗示着努力与回报并存。",
    },
  },
  sanctuary: {
    literal: {
      en: "A safe place; a refuge or shelter from danger or difficulty.",
      zh: "一个安全的地方；远离危险或困难的避难所或庇护所。",
    },
    contextual: {
      en: "The author uses 'sanctuary' to elevate reading to a sacred status, suggesting that books provide spiritual refuge and protection from the chaos of everyday life.",
      zh: "作者使用'避难所'将阅读提升到神圣的地位，暗示书籍为日常生活中的混乱提供了精神上的庇护和保护。",
    },
  },
  transformative: {
    literal: {
      en: "Causing or able to cause a significant change or improvement in something.",
      zh: "导致或能够导致某事物的重大改变或改善。",
    },
    contextual: {
      en: "In context, 'transformative' implies that reading fundamentally alters the reader's mind, suggesting a powerful, perhaps even revolutionary effect on human cognition.",
      zh: "在上下文中，'变革性的'意味着阅读从根本上改变了读者的思维，暗示对人类认知的强大甚至革命性的影响。",
    },
  },
  horizon: {
    literal: {
      en: "The line where the earth and sky appear to meet; the farthest extent of vision.",
      zh: "地球与天空相交可见的线；视野的最远范围。",
    },
    contextual: {
      en: "Figuratively, 'horizons' represents the expansion of one's knowledge, understanding, and possibilities through reading, suggesting intellectual and experiential growth.",
      zh: "比喻性地，'视野'代表了通过阅读扩展的知识、理解和可能性，暗示着智力和经验的成长。",
    },
  },
  decode: {
    literal: {
      en: "Convert a coded message or symbols into intelligible language.",
      zh: "将编码的信息或符号转换为可理解的语言。",
    },
    contextual: {
      en: "The author deliberately uses 'decode' to suggest that reading is more than passive recognition—it requires interpretation and the unlocking of meaning.",
      zh: "作者特意使用'解码'来表示阅读不仅仅是被动地识别——它需要解释和意义的解锁。",
    },
  },
  engagement: {
    literal: {
      en: "The act of engaging or being engaged; involvement or participation.",
      zh: "参与或被参与的行为； involvement or participation.",
    },
    contextual: {
      en: "Here, 'engagement' suggests a dynamic, interactive relationship between reader and text, where meaning is co-created rather than passively received.",
      zh: "在这里，'参与'暗示读者与文本之间动态、互动的关像，其中意义是共同创造的，而不是被动接受的。",
    },
  },
  deliberately: {
    literal: {
      en: "In a careful and unhurried way; slowly and intentionally.",
      zh: "以谨慎且不急迫的方式；缓慢而有意地。",
    },
    contextual: {
      en: "The word emphasizes that effective reading requires intentionality and patience, contrasting with modern tendencies toward rapid, superficial consumption.",
      zh: "这个词强调有效阅读需要有意为之和耐心，与现代快速、肤浅的消费倾向形成对比。",
    },
  },
  sustainability: {
    literal: {
      en: "The ability to be maintained at a certain rate or level; ecological balance.",
      zh: "以某种速率或水平维持的能力；生态平衡。",
    },
    contextual: {
      en: "In context, 'sustainability' refers to urban planning that meets present needs without compromising future generations' resources, encompassing environmental, social, and economic dimensions.",
      zh: "在上下文中，'可持续性'指的是满足当前需求而不损害后代资源的城市规划，涵盖环境、社会和经济维度。",
    },
  },
  unprecedented: {
    literal: {
      en: "Never done or known before; without previous example.",
      zh: "从未做过或已知；没有先例。",
    },
    contextual: {
      en: "The word underscores the severity and uniqueness of current climate change, suggesting that human civilization has never faced this particular challenge before.",
      zh: "这个词强调当前气候变化的严重性和独特性，表明人类文明以前从未面临过这一特定挑战。",
    },
  },
};

function getWordAnnotationData(
  word: string,
  paragraph: string
): {
  literal: { english: string; chinese: string };
  contextual: { english: string; chinese: string };
} {
  const normalizedWord = word.toLowerCase().trim();

  // Check if we have a predefined response
  if (wordDefinitions[normalizedWord]) {
    const def = wordDefinitions[normalizedWord];
    return {
      literal: { english: def.literal.en, chinese: def.literal.zh },
      contextual: { english: def.contextual.en, chinese: def.contextual.zh },
    };
  }

  // Generate generic response based on word characteristics
  const firstLetter = normalizedWord.charAt(0);
  const hasGreekLatinRoot = /^[a-e]/i.test(normalizedWord);

  return {
    literal: {
      english: `The word "${word}" is being used in its standard English meaning, referring to the general concept or object it typically denotes.`,
      chinese: `单词"${word}"使用的是其标准英语含义，指的是它通常表示的一般概念或对象。`,
    },
    contextual: {
      english: `In this specific passage, "${word}" takes on additional nuanced meaning within its context. The author's usage suggests a deeper significance beyond the literal definition, reflecting the thematic concerns of the text regarding ${hasGreekLatinRoot ? "classical foundations" : "natural evolution"}.`,
      chinese: `在这段特定的文字中，"${word}"在其上下文中的含义超越了字面意义，暗示了更深层的重要性。`,
    },
  };
}

function getSentenceExplanation(
  sentence: string
): { english: string; chinese: string } {
  // Generate contextual explanation based on sentence characteristics
  const wordCount = sentence.split(/\s+/).length;
  const hasMetaphor = /like|as|than|compared|suggests|implies|represents/i.test(sentence);
  const hasEmotion = /feel|believe|hope|love|hate|fear|joy|sorrow|passion/i.test(sentence);
  const hasAcademic = /however|therefore|thus|hence|furthermore|consequently|evidence|suggests/i.test(
    sentence
  );

  let englishExplanation: string;
  let chineseExplanation: string;

  if (hasAcademic) {
    englishExplanation = `This sentence presents a logical argument or conclusion. The author uses ${hasMetaphor ? "comparative language" : "precise academic diction"} to establish a cause-and-effect relationship or draw a reasoned conclusion. The sentence structure facilitates clear communication of complex ideas, guiding the reader through a methodical progression of thought.`;
    chineseExplanation = `这句话提出了一个逻辑论点或结论。作者使用${hasMetaphor ? "比较性语言" : "精确的学术措辞"}来建立因果关系或得出合理的结论。句子结构有助于清晰地传达复杂思想，引导读者通过系统的思维进程。`;
  } else if (hasEmotion) {
    englishExplanation = `In my own words, this sentence expresses an emotional or personal perspective. The author conveys inner feelings and subjective experiences, creating an intimate connection with the reader. The language choices evoke specific emotional responses and invite empathy or identification.`;
    chineseExplanation = `用我自己的话来说，这句话表达了情感或个人视角。作者传达了内在感受和主观体验，与读者建立了亲密的联系。语言选择唤起特定的情感反应，并邀请读者产生共鸣或认同。`;
  } else if (hasMetaphor) {
    englishExplanation = `Put simply, this sentence uses figurative language to make a comparison or convey abstract ideas through concrete images. The author draws parallels between seemingly unrelated concepts, encouraging readers to see familiar things in new ways and revealing hidden connections.`;
    chineseExplanation = `简单地说，这句话使用比喻语言来进行比较或通过具体形象传达抽象概念。作者在看似无关的概念之间建立类比，鼓励读者以新的方式看待熟悉的事物，揭示隐藏的联系。`;
  } else {
    englishExplanation = `This sentence conveys a descriptive or narrative point. The author presents information in a straightforward manner, establishing facts or circumstances that form the foundation for later arguments or developments. It serves as building blocks for the larger narrative structure.`;
    chineseExplanation = `这句话传达了描述性或叙事性的观点。作者以直接的方式呈现信息，建立为后续论点或发展奠定基础的事实或情况。它作为更大叙事结构的组成部分。`;
  }

  return {
    english: englishExplanation,
    chinese: chineseExplanation,
  };
}

function getStyleAnalysis(
  articleTitle: string
): {
  analysis: StyleReport["analysis"];
  wordCount: number;
} {
  // Generate style analysis based on article characteristics
  if (articleTitle.includes("Art of Reading")) {
    return {
      analysis: {
        diction: {
          english:
            "The author employs a rich, literary vocabulary combining everyday words with sophisticated terms like 'decoding,' 'sanctuary,' and 'transformative.' This elevates the prose while maintaining accessibility. The choice of 'journey' and 'horizons' adds metaphorical depth.",
          chinese:
            "作者运用了丰富的文学词汇，将日常用语与'解码'、'避难所'和'变革性'等 sophisticated 词汇相结合。这提升了散文的格调，同时保持了可读性。'旅程'和'视野'的选择增添了隐喻的深度。",
        },
        sentenceStructure: {
          english:
            "Sentences vary in length and complexity, creating a natural rhythm. Short, punchy statements ('Reading is not merely...') punctuate longer, flowing constructions. The periodic structure in paragraph three encourages sustained attention.",
          chinese:
            "句子在长度和复杂性上有所变化，创造出自然的节奏。简短有力的陈述（'阅读不仅仅是...'）穿插在较长的流畅句子中。第三段的圆周句结构鼓励读者保持持续的关注。",
        },
        figureOfSpeech: {
          english:
            "The dominant metaphor is the journey—a recurring image that structures the entire essay. Personification appears in 'shapes our minds' and 'expands our horizons.' The text also uses synecdoche in referring to reading as representing human essence.",
          chinese:
            "主导隐喻是旅程——这是一个贯穿整篇文章的 recurring 意象。在'塑造我们的思维'和'扩展我们的视野'中使用了拟人化。文本还使用了提喻，用阅读来代表人类的本质。",
        },
        rhetoric: {
          english:
            "The author employs rhetorical questions to engage readers ('In the quiet sanctuary...?'). Parallelism structures key passages ('to linger... to wrestle... to savor'). Anaphora ('They question, they predict...') emphasizes the active reader's qualities.",
          chinese:
            "作者使用反问句来吸引读者（'在安静的避难所...?'）。排比结构构成了关键段落（'徘徊...奋斗...品味...'）。首语重复法（'他们质疑，他们预测...'）强调了活跃读者的特质。",
        },
        tone: {
          english:
            "The tone is contemplative, earnest, and persuasive—conveying genuine passion for reading without being preachy. There's a reverent but not reverential attitude toward literature. The closing line shifts from intellectual to philosophical, leaving readers with a sense of wonder.",
          chinese:
            "语气是沉思的、真诚的和有说服力的——传达了对阅读的真正热情而不显得说教。对文学持尊重但不虔诚的态度。最后一句从理性转向哲学，给读者留下一种惊奇感。",
        },
      },
      wordCount: 287,
    };
  } else if (articleTitle.includes("Climate")) {
    return {
      analysis: {
        diction: {
          english:
            "The vocabulary balances scientific terminology ('greenhouse gases,' 'pre-industrial') with accessible language. Technical terms like 'carbon dioxide' and 'renewable' are chosen for their clarity. Words like 'alarming' and 'bitter' inject emotional weight into factual statements.",
          chinese:
            "词汇在科学术语（'温室气体'、'工业前'）和通俗语言之间取得平衡。'二氧化碳'和'可再生'等技术术语的选择因其清晰性。'令人震惊'和'严酷'等词为事实陈述注入了情感分量。",
        },
        sentenceStructure: {
          english:
            "The structure alternates between complex, information-dense sentences and simpler declarative ones. This creates an authoritative yet readable flow. Cause-and-effect relationships are made explicit through connectors like 'therefore,' 'consequently,' and 'because.'",
          chinese:
            "结构在复杂、信息密集的句子和更简单的陈述句之间交替。这创造了一种权威而可读的流动。因果关系通过'因此'、'结果'和'因为'等连接词变得明确。",
        },
        figureOfSpeech: {
          english:
            "Personification appears in 'a cold and cruel pneumonia visited.' The text uses metonymy in 'humanity has proven before.' Climate change itself is presented through the prism of a challenge or antagonist, giving abstract forces human-like agency.",
          chinese:
            "在'肺炎这个冷酷而残酷的访问'中使用了拟人化。文本在'人类以前证明过'中使用了换喻。气候变化本身通过挑战或反派的棱镜呈现，赋予了抽象力量人类般的能动性。",
        },
        rhetoric: {
          english:
            "Statistics ('1.1 degrees Celsius') lend credibility. The rhetorical question 'The question now is not...' redirects from problems to solutions. Contrast is used throughout ('past and future,' 'sacrifice and innovation') to highlight the stakes.",
          chinese:
            "统计数据（'1.1摄氏度'）增加了可信度。反问句'现在的问题不是...'将焦点从问题转向解决方案。对比贯穿全文（'过去和未来'、'牺牲和创新'），突出了利害关系。",
        },
        tone: {
          english:
            "The overall tone shifts from alarm in the problem description to cautious optimism in the solutions section. There's an authoritative but not condescending voice—treating readers as capable of understanding complexity and taking meaningful action.",
          chinese:
            "整体语气从问题描述中的警示转变为解决方案部分中的谨慎乐观。是一种权威但不居高临下的声音——将读者视为能够理解复杂性并采取有意义行动的人。",
        },
      },
      wordCount: 265,
    };
  } else {
    return {
      analysis: {
        diction: {
          english:
            "O. Henry's diction is deceptively simple—using short, common words to build complex emotional effects. Literary terms and artistic language ('Bohemia,' 'genius,' 'masterpiece') contrast with everyday speech. Names carry symbolic weight: Johnsy suggests fragility; Sue suggests companionship.",
          chinese:
            "O·亨利的措辞看似简单——用简短、常见的词语来建立复杂的情感效果。文学术语和艺术语言（'波希米亚'、'天才'、'杰作'）与日常言语形成对比。名字带有象征意义：Johnsy 暗示脆弱；Sue 暗示陪伴。",
        },
        sentenceStructure: {
          english:
            "The sentences are predominantly short and declarative, creating a rapid, storytelling pace. This simplicity contrasts with the emotional complexity of the narrative. Dialogue is rendered in plain speech, heightening authenticity and character differentiation.",
          chinese:
            "句子主要简短且陈述性的，创造出快速的讲故事节奏。这种简单性与叙事的情感复杂性形成对比。对话以简单的言语呈现，增强了真实感和角色区分。",
        },
        figureOfSpeech: {
          english:
            "The 'last leaf' functions as the central symbol—the intersection of art, life, and sacrifice. The old brick wall represents time and the endurance of art. Behrman's painted leaf is a metonym for the artist's final, greatest work and legacy.",
          chinese:
            "'最后一片叶子'是核心象征——艺术、生命和牺牲的交汇点。旧砖墙代表了时间和艺术的坚韧。Behrman 画的叶子是艺术家最后、最伟大作品和遗产的转喻。",
        },
        rhetoric: {
          english:
            "The narrative employs dramatic irony—the reader understands the leaf is painted while Johnsy believes it real. Foreshadowing appears in the description of Behrman's ambition to paint a masterpiece. The twist ending fulfills narrative expectations while subverting them.",
          chinese:
            "叙事使用了戏剧性的反讽——读者知道叶子是画上去的，而 Johnsy 认为它是真的。在对 Behrman 创作杰作的野心的描述中出现了伏笔。逆转的结局满足了叙事的期望同时颠覆了它们。",
        },
        tone: {
          english:
            "The tone moves from light and whimsical (describing the artists' colony) through dramatic tension (Johnsy's illness) to profound pathos (Behrman's sacrifice). O. Henry maintains an affectionate, even reverent view of artists and their devotion to beauty.",
          chinese:
            "语气从轻松活泼（描述艺术家聚居地）经过戏剧性张力（Johnsy 的病情）到深切的悲情（Behrman 的牺牲）。O·亨利对艺术家及其对美的奉献保持着一种亲切的、甚至虔诚的看法。",
        },
      },
      wordCount: 278,
    };
  }
}

export async function generateWordAnnotation(
  word: string,
  paragraph: string
): Promise<WordAnnotation> {
  // Simulate API delay
  await delay(1000 + Math.random() * 1500);

  const data = getWordAnnotationData(word, paragraph);

  return {
    id: `word-${Date.now()}`,
    type: "word",
    word: word,
    paragraph: paragraph,
    literalMeaning: data.literal,
    contextualMeaning: data.contextual,
    timestamp: new Date(),
  };
}

export async function generateSentenceAnnotation(
  sentence: string,
  contextBefore: string[],
  contextAfter: string[]
): Promise<SentenceAnnotation> {
  // Simulate API delay
  await delay(1500 + Math.random() * 1500);

  return {
    id: `sentence-${Date.now()}`,
    type: "sentence",
    sentence: sentence,
    contextBefore,
    contextAfter,
    explanation: getSentenceExplanation(sentence),
    timestamp: new Date(),
  };
}

export async function generateStyleReport(
  title: string,
  content: string
): Promise<StyleReport> {
  // Simulate longer API delay for complex analysis
  await delay(2000 + Math.random() * 2000);

  const { analysis, wordCount } = getStyleAnalysis(title);

  return {
    id: `style-${Date.now()}`,
    type: "style",
    title,
    analysis,
    wordCount,
    timestamp: new Date(),
  };
}
