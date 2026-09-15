import fs from "node:fs";
import path from "node:path";

const STORE_SLUG = "paradise-gastro-bar";
const STORE_NAME = "Paradise Gastro Bar";

const rows = [
  ["Entradas","Causa de pollo",10,"Papa suave y sedosa con toques de ají amarillo y limón, rellena de una deliciosa mezcla de pollo cremoso y aguacate."],
  ["Entradas","Copa de leche de tigre",12,"Intenso jugo de pescado y limón, potenciado con ajíes y cilantro, con trozos de pescado fresco, batata glaseada, cebolla morada y maíz crocante."],
  ["Entradas","Croqueta de camarón",10,"3 unidades. Cremosa bechamel infusionada con esencia de mar, rellena de jugosos camarones, con un exterior crujiente y dorado."],
  ["Entradas","Crostini al ajo y hierbas frescas",6,"Crujientes rodajas de pan dorado, untadas con una suave mantequilla de ajo, cilantro fresco y perejil."],
  ["Entradas","Papas a la huancaína",10,"Suaves bolitas de puré de papa bañadas en una cremosa salsa huancaína, coronadas con huevo y aceituna."],
  ["Ensaladas","Crispy Chicken Bowl",12,"Ensalada de mix de lechuga crujiente, tomate y aros de cebolla morada, coronada con tiras de pollo crispy recién empanizado. Acompañada con nuestro aderezo de miel mostaza, que equilibra dulzor y acidez en cada bocado."],
  ["Ensaladas","Paradise Tropical",14,"Cama de mix de lechuga fresca y crujiente con tomate, láminas de pepino y cebolla morada, acompañada de atún y gajos de mandarina dulce. Espolvoreada con orégano seco y bañada con una vinagreta de parchita."],
  ["Sopas","Chupe de camarones",15,"Sopa cremosa con camarones, toque de ajíes peruanos, leche, huevo y cilantro. Frescura y sabor a mar en cada bocado."],
  ["Sopas","Parihuela",19,"Sopa de la costa del Perú con un caldo profundo cargado de pescado, camarones y calamares, con el toque justo de ají."],
  ["Ceviches","Ceviche con ají amarillo",14,"Ceviche de pescado fresco marinado en leche de tigre clásica, con cebolla morada en juliana, ají y cilantro fresco. Bañado con una suave crema de ají amarillo que aporta un picor sedoso. Servido con batata glaseada y cancha crocante."],
  ["Ceviches","Ceviche con crema de rocotto",14,"La frescura ácida del ceviche clásico se potencia con una crema de rocoto. Su picor frutal y profundo envuelve cada trozo de pescado, mientras la cebolla morada y el cilantro refrescan el paladar."],
  ["Ceviches","Ceviche de mariscos mixtos",19,"Pescado, camarones, calamar y pulpo infusionados en limón y leche de tigre, con cebolla, ají y cilantro. Acompañado de batata glaseada, maíz crocante y tostones."],
  ["Ceviches","Ceviche tradicional",12,"Pescado fresco marinado con limón y leche de tigre, cebolla, ají y cilantro, acompañado con batata glaseada, maíz y tostones."],
  ["Criollos","Costillas estofadas al vino tinto",15,"Tiernas costillas en salsa de tomate y reducción de vino tinto, acompañadas con cremoso puré de papas."],
  ["Criollos","Lomo saltado",15,"Jugosos cubos de lomo de res salteados a fuego vivo con cebollas, tomates y ajíes andinos, bañados con la salsa secreta de la casa. Acompañado de arroz y crujientes papas fritas."],
  ["Criollos","Rigatoni huanca y lomo",14,"Rigatonis al dente envueltos en nuestra cremosa salsa huancaína, coronados con jugosos cubos de lomo saltado."],
  ["Criollos","Risotto a la huancaína con lomo al jugo",18,"Cremoso risotto con salsa huancaína y un jugoso lomo salteado con tomates, cebollas y ajíes andinos. La suavidad del arroz, el toque picante del ají y la fuerza del lomo se unen en un plato inolvidable."],
  ["Criollos","Tallarines frutos del mar",19.99,"Fetuccinis con salsa pomodoro infusionada con ajíes peruanos, aceitunas negras y mariscos frescos."],
  ["Criollos","Tallarines saltado de carne",12,"Carne salteada con cebollas, tomates y ajíes andinos, sobre fetuccinis bañados con la salsa secreta de la casa. Una fusión entre la tradición criolla y el toque chifa."],
  ["Criollos","Tallarines saltado de pollo",10,"Pollo salteado con cebollas, tomates y ajíes andinos, sobre fetuccinis bañados con la salsa secreta de la casa. Una fusión entre la tradición criolla y el toque chifa."],
  ["Marinos","Arroz con mariscos",19,"Arroz suelto y envolvente, cocinado lentamente en un suave caldo de pescado, con generosos trozos de camarones, calamares, pulpo, mejillones, ají amarillo y un toque de cilantro."],
  ["Marinos","Chicharrón de camarón",25,"Camarones frescos en tempura crujiente, fritos hasta un dorado perfecto. Servidos con salsa tártara de la casa y gajos de limón fresco para exprimir al gusto."],
  ["Marinos","Chicharrón de pescado",19.99,"Trozos de pescado empanizados, dorados hasta quedar crujientes por fuera y jugosos por dentro, acompañados de cebolla morada encurtida y salsa tártara de la casa."],
  ["Marinos","Explosión marina",28,"Trozos crujientes de pescado, calamares y camarones empanizados y dorados a la perfección, acompañados de cebolla morada encurtida, yuca frita, tostones y nuestra salsa tártara de la casa."],
  ["Marinos","Risotto Paradise",16,"Cremoso risotto italiano que se encuentra con la frescura del mar peruano y sus sabores criollos."],
  ["Marinos","Trío marino",19.99,""],
  ["Chifa","Chaufa de mariscos",15,"Arroz salteado con camarón, calamar, mejillón y pulpo, infusionado con notas de jengibre y ajo."],
  ["Chifa","Chaufa de pollo",12,"Arroz suelto y sabroso con el inconfundible sabor del wok, salteado con jugosos trozos de pollo, cebollín, tortilla de huevo y el toque secreto de la casa."],
  ["Chifa","Chaufa especial",14,"Arroz suelto y lleno de sabor, con pollo, lomito, mariscos, tortilla de huevo, cebollín y la salsa secreta de la casa."],
  ["Brasas","Parrilla de carne y pollo 2 personas",25,"Parrilla para compartir entre 2 personas, acompañada con papas doradas, ensalada fresca y chimichurri de la casa."],
  ["Brasas","Parrilla de carne y pollo personal",16,"Deliciosa parrilla mixta acompañada con papas a la francesa, ensalada fresca y chimichurri de la casa."],
  ["Brasas","Parrilla mar y tierra 2 personas",28,"Carne de res a la parrilla con camarones, calamares y pechuga de pollo, acompañada de papas doradas, ensalada fresca y chimichurri de la casa. Presentación para 2 personas."],
  ["Brasas","Parrilla mar y tierra personal",18,"Jugoso corte de res a la parrilla, acompañado de mix de mariscos y pechuga de pollo jugosa, con papas doradas, ensalada fresca y chimichurri de la casa."],
  ["Fusión","Cerviche cerdo acevichado",15,"Crocantes trozos de pork belly marinados en una leche de tigre de ají amarillo ahumado, acompañados de cebolla morada encurtida y una arena de tostones. Una combinación de frescura y sabor que combina lo mejor del cerdo con la acidez vibrante del ceviche."],
  ["Fusión","Patacones con picante de mariscos",13,"Patacones crujientes con una salsa cremosa de mix de mariscos infusionada con ajíes peruanos."],
  ["Fusión","Torrejitas con ceviche",10,"Torrejitas de jojoto crujientes por fuera y suaves por dentro, acompañadas de un fresco ceviche. La textura dorada de la torrejita se combina con la acidez y frescura del mar."],
  ["Fusión","Causa reina pepiada",12,"Una base de papa amarilla fresca con toques de limón y ají, rellena con una deliciosa crema reina pepiada. La frescura de Venezuela se encuentra con la tradición peruana."],
  ["Snacks","Tequeños de ají de gallina",6.5,""],["Snacks","Tequeños de queso",8,""],["Snacks","Alitas a la parmesano",10,""],["Snacks","Alitas BBQ",10,""],["Snacks","Alitas de pollo acevichadas",10,""],["Snacks","Alitas miel mostaza",12,""],["Snacks","Bufalo Wings",11,""],["Snacks","Hamburguesa clásica",12,""],["Snacks","Hamburguesa crispy",14,""],["Snacks","Hamburguesa doble",15,""],["Snacks","Hamburguesa keto",8,""],["Snacks","Hamburguesa camarón",12,""],["Snacks","Nachos con carne y queso",8,""],["Snacks","Pan con chicharrón",9.99,""],
  ["Menú Kids","Tenders con papas",9.99,"Tiras de pollo jugoso empanizadas con un rebozado dorado y súper crocante, acompañadas de nuestras papas fritas."],
  ["Postres","Brownie con helado",6,"Brownie de chocolate intenso, ligeramente tibio, acompañado de una bola de helado de vainilla."],
  ["Postres","Suspiro Paradise",8,"El tradicional suspiro a la limeña se funde con la dulzura del tres leches venezolano. Una cremosa base de manjar blanco infusionado con especias, coronada con un merengue italiano ligeramente tostado."],
  ["Frozen","Frozen fresa",5,""],["Frozen","Frozen maracumango",4,""],["Frozen","Frozen Paradise",4,""],["Frozen","Frozen durazno",4,""],["Frozen","Frozen guanábana",5,""],["Frozen","Frozen parchita",5,""],["Frozen","Frozen mora",4.99,""],
  ["Refrescos","Pepsi Light lata",2.5,""],["Refrescos","Refrescos botella",1.5,""],["Refrescos","Agua 600 ml",2,""],["Refrescos","Agua Sparking limón",2.5,""],["Refrescos","Agua Sparking soda",2.5,""],["Refrescos","Bebida energizante Rockstar",1.3,""],["Refrescos","Chicha morada",7,"Bebida de maíz morado, piña, manzana y especias. Una tradición peruana refrescante, afrutada y deliciosa."],["Refrescos","Gatorade",3,""],["Refrescos","Infusiones",4,""],["Refrescos","Lipton",3,""],["Refrescos","Malta retornable",1.5,""],["Refrescos","Refresco de lata",2.5,""],
  ["Milkshakes","Milkshake de Oreo",6.99,"Helado de vainilla, leche y abundantes trozos de galleta Oreo, todo batido hasta lograr una textura suave y espesa."],
  ["Milkshakes","Milkshake de pie limón",6.99,"Cremoso helado de vainilla y leche se mezclan con un toque intenso de jugo de limón, ralladura y leche condensada, logrando el equilibrio entre lo ácido y lo dulce."],
  ["Milkshakes","Milkshake de Pirulín",6.99,"El barquillo Pirulín se fusiona con helado de vainilla, creando una textura suave, coronada con un generoso topping de chocolate y barquillo triturado."],
  ["Milkshakes","Milkshake de Samba",6.99,"Cremoso helado de vainilla se fusiona con la emblemática galleta Samba, creando una textura suave y un sabor dulce con ese toque inconfundible de avellanas."],
  ["Cócteles y tragos","Cuba libre",4,"Ron oscuro, refresco de cola y un generoso toque de limón. Dulce, burbujeante y con la fuerza del Caribe."],
  ["Cócteles y tragos","Pisco sour",9.99,"Pisco puro, jugo de limón fresco, jarabe de goma, clara de huevo y un toque de amargo de angostura. Espumoso, cítrico y perfectamente equilibrado."],
];

const categoryOrder = [...new Set(rows.map((row) => row[0]))];

function sql(value) {
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return `'${String(value ?? "").replaceAll("'", "''")}'`;
}

function values(list) {
  return list.map((row) => `(${row.map(sql).join(",")})`).join(",\n");
}

function buildSql() {
  const categories = categoryOrder.map((name, index) => [name, index + 1, name !== "Cócteles y tragos"]);
  const products = rows.map(([category, name, price, description], index) => [
    category,
    name,
    description,
    price,
    index + 1,
    category !== "Cócteles y tragos",
  ]);

  return `do $$
declare
  v_store_id uuid;
  v_category_id uuid;
  v_product_id uuid;
  r record;
begin
  select id into v_store_id
  from public.stores
  where slug = '${STORE_SLUG}' and lower(btrim(name)) = lower('${STORE_NAME}');

  if v_store_id is null then
    raise exception 'No existe el comercio exacto ${STORE_NAME} / ${STORE_SLUG}';
  end if;

  create temp table tmp_paradise_categories(name text primary key, sort_order int, active boolean, id uuid) on commit drop;
  insert into tmp_paradise_categories(name, sort_order, active) values
${values(categories)};

  for r in select * from tmp_paradise_categories loop
    select id into v_category_id
    from public.categories
    where store_id = v_store_id and lower(btrim(name)) = lower(btrim(r.name))
    order by created_at limit 1;

    if v_category_id is null then
      insert into public.categories(store_id, name, sort_order, is_active)
      values(v_store_id, r.name, r.sort_order, r.active)
      returning id into v_category_id;
    else
      update public.categories
      set name = r.name, sort_order = r.sort_order, is_active = r.active
      where id = v_category_id;
    end if;

    update tmp_paradise_categories set id = v_category_id where name = r.name;
  end loop;

  create temp table tmp_paradise_products(category_name text, name text, description text, price numeric, sort_order int, active boolean, primary key(category_name, name)) on commit drop;
  insert into tmp_paradise_products(category_name, name, description, price, sort_order, active) values
${values(products)};

  for r in select p.*, c.id category_id from tmp_paradise_products p join tmp_paradise_categories c on c.name = p.category_name loop
    select id into v_product_id
    from public.products
    where store_id = v_store_id and category_id = r.category_id and lower(btrim(name)) = lower(btrim(r.name))
    order by created_at limit 1;

    if v_product_id is null then
      insert into public.products(store_id, category_id, name, description, price_usd, discount_percent, image_url, is_available, is_featured, sort_order)
      values(v_store_id, r.category_id, r.name, r.description, r.price, 0, null, r.active, false, r.sort_order);
    else
      update public.products
      set category_id = r.category_id, name = r.name, description = r.description, price_usd = r.price,
          discount_percent = 0, image_url = null, is_available = r.active, is_featured = false,
          sort_order = r.sort_order, updated_at = now()
      where id = v_product_id;
    end if;
  end loop;
end $$;`;
}

if (rows.length !== 79) {
  throw new Error(`Catalogo incompleto: ${rows.length} productos, se esperaban 79.`);
}

const output = path.resolve("tmp/paradise-gastro-bar-catalog.sql");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, buildSql(), "utf8");
console.log(output);
