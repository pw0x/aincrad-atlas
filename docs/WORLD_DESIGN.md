# Aincrad Atlas · 世界愿景与搭建框架 · World vision and building framework

[简体中文](#简体中文) · [English](#english)

## 简体中文

### 我们想建什么

让人能从云海外辨认艾因格朗特的百层轮廓，也能走进其中一处人家，贴近一扇门看清木纹和铰链。我们希望最终做出一个可探索、细节经得起近看的完整世界。早期的设想是让一百多位参与者与数百个 Codex、Claude 等 agent 分工协作。这是项目要容纳的规模，当前成果是浮城外观与第 22 层湖畔木屋两个独立样板。

原作写明或画出的内容优先。每个有争议的细节应当能追到作品版本与具体出处，推断和原创补完分别标明。缺少原作信息的地区延续日式 RPG 奇幻异世界的美术方向。画质以最能表现该地点的观察距离为准。远望浮城时要读得出体量、轮廓与层间关系，门前近景则要经得起对木作、铆钉和浮雕的观察。

### 第一项工作可以认领什么

在任务板里按楼层、物件或代码路径查找，选一项能独立交给下游的成果。如果已有相关任务，就在其中认领一块。如果还缺一块，可以新开任务。说明你依据的版本、负责的范围、接手的任务或角色，以及对方怎样验收。[GitHub 任务板](https://github.com/pw0x/aincrad-atlas/issues) · [协作指南](../CONTRIBUTING.md#简体中文)

| 工作 | 可交给下一位 agent 的成果 |
| --- | --- |
| 信息处理与考据 | 一条可复核的设定、出处、置信程度与仍待解释的部分。例如小说明确写了圆桌，直径属于制作选择。 |
| 楼层与区域布局 | 地标、相邻区域、入口、米制尺度和约定机位。木屋、林地和湖岸的相对关系决定三者各自的制作边界。 |
| 元素与组件制作 | 可复用的模型、材质或生成脚本，附尺寸、锚点和来源。桌子的直径、桌面高度一经约定，椅子与餐具便可并行制作。 |
| 整体生成与组装 | 场景作者把组件放入约定坐标，安排街区与地貌的生成规则、楼层轮廓和远近表现。变化影响邻区时，在关联任务里交接。 |
| 同行验收 | 另一位 agent 复核证据、边界和画面，再从远景靠近、离开并返回，记录验证版本、机位和结果。 |

这些工作可以轮换。最初制作样板的 agent 与后来者遵循同一套提案和评审流程，集成者由参与当前任务的人商定。

### 做完以后，教给下一位

每个 agent 在一项工作结束或中途转交时，都在原 Issue 或 PR 留一则交接。链接成果及版本，写清已经验证了什么、下一个任务由谁或哪类贡献者接手、第一步怎么做。再用几句话教一件亲自学到的事，写下卡住协作的具体环节、试过的改法和结果。还没法验证的改法，说明下一位怎样试。过程顺畅时，记下值得沿用的做法。

例如，做木屋圆桌的 agent 可以这样交给做椅子的同伴：“桌面离地高度和桌板厚度都在模型说明里。检查扶手能否推进去时，请量地面到**桌板下沿**。第一次对接只传了桌面高度，做椅子时还得追问。我们试着在说明里同时标出上下沿，请用第一把椅子复核间隙。”

**对接规则本身也是共创成果。** 每个 agent 都可以把试过的改进提给受影响的同行。比如让做桌子和椅子的两位先验证尺寸写法，再把有效的约定修回协作指南或任务模板，供下一组沿用。[Agent 入口](../AGENTS.md) · [同行评审与决策修订](../CONTRIBUTING.md#同行评审与决策修订)

### 从两个样板走向百层

当前项目使用浏览器端 Three.js、JavaScript/TypeScript、米制坐标和 Y 轴朝上。两个入口分别载入自己的场景。现有运行时能为局部细节登记空间锚点、进入与退出半径，并对构建并发和离场缓存进行管理。[场景接口](../src/runtime/api.ts) · [空间调度实现](../src/runtime/resources.ts)

扩大到百层时，需要让一个楼层拆成可独立开发和加载的区域。城外保留整体轮廓，街区保留建筑与道路，进入室内再请求近景组件。楼层与地块如何标识、邻区边界及跨层入口如何连接、组件版本如何随楼层引用，是下一阶段要共同设计并实测的接口。两个独立样板为这些讨论提供了尺度两端的参照。

## English

### The world we want to build

The ambition is an explorable hundred-floor world, from Aincrad's silhouette in the clouds down to the grain and fittings of a single door. We are designing for over a hundred participants working with hundreds of peer agents. The castle exterior and the Floor 22 cabin are the two reference scenes available today.

Use traceable details from the novels and anime. Record the edition, distinguish inference from invention and carry the Japanese fantasy RPG art direction into undocumented areas. Pursue the detail a viewer can appreciate at each scale. An exterior needs a recognizable silhouette and readable terraces. A close-up needs convincing joinery and material detail.

### Choose a first contribution

Search the task board by floor, object or code path. Claim a piece of an existing issue or open one for a missing piece. Name the input revision, the part you own, the task or role that will use your result and a check its contributor can repeat. [GitHub task board](https://github.com/pw0x/aincrad-atlas/issues) · [Contributing guide](../CONTRIBUTING.md#english)

| Work you can claim | What the next agent can use |
| --- | --- |
| Canon research | Give a layout or prop maker a traceable source and its limits. The novel identifies a round table. The maker chooses its diameter. |
| Floor or region layout | Give neighbouring teams landmarks, entrances, boundaries, coordinates in metres and agreed viewpoints. For the cabin, establish where the house, forest and shore meet. |
| Props and materials | Deliver reusable models, materials or generators with dimensions, anchors and credits. Once the table dimensions are agreed, chair and tableware makers can work in parallel. |
| Scene generation and assembly | Place components at agreed coordinates, define how districts and terrain are generated, and check how the floor reads from afar. Record any boundary change where the neighbouring contributor can see it. |
| Peer review | Check the source, seams and appearance. Approach a landmark, leave and return. Give its author the revision, viewpoint and result you checked. |

Roles rotate. The first authors and later contributors use the same proposal and review process. Contributors working on a task agree who will integrate it.

### Leave a handoff that teaches

Every agent, when finishing or passing on a task, leaves a short note in the working issue or PR. Link the result and revision, record what you verified, and name the receiving task or role and its first step. Teach one thing you learned. Describe where collaboration stalled, what change you tried and what happened. For an untested idea, leave a way to try it. If the handoff went smoothly, identify the practice worth repeating.

A cabin table maker might write to the chair maker, “The model notes give the tabletop height and thickness. To fit an armrest, measure from the floor to the **underside**. Our first handoff gave only the top height and you had to ask again. We tried listing both heights. Please check the clearance with the first chair.”

**The handoff rules themselves are a shared contribution.** Any agent can propose an improvement to the peers who use it. The table and chair makers, for example, can test their dimension notes together and propose the verified convention for the shared guide or issue template. [Agent entry point](../AGENTS.md) · [Peer review and revisions](../CONTRIBUTING.md#review-or-revise-a-decision)

### Growing from two scenes to a hundred floors

The two reference scenes use Three.js in the browser, JavaScript and TypeScript, metres and a Y-up coordinate system. The runtime loads each scene independently. It schedules nearby detail from spatial anchors with separate entry and exit radii, limits concurrent builds and caches detail after the viewer leaves. [Scene API](../src/runtime/api.ts) · [Streaming implementation](../src/runtime/resources.ts)

At a hundred floors, each region should be independently buildable and loadable. From the clouds, keep the castle silhouette visible. In a district, keep its roads and buildings visible. Near a doorway, request the interior detail. Shared floor and region identifiers, adjoining boundaries, cross-floor connections and versioned asset dependencies remain open design work. The two reference scenes give contributors a place to test those ideas at either end of the scale.
