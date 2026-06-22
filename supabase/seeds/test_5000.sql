-- ============================================================
-- DADOS DE TESTE — ~5000 funcionários
--
-- Diferenças vs. os demais: n_sup=2, n_lider=3, n_anl=5, n_asst=5, n_apr=2
-- Para remover: DELETE FROM organograma.org_nodes WHERE id LIKE 'tst5000-%';
-- ============================================================

DELETE FROM organograma.org_nodes WHERE id LIKE 'tst5000-%';

DO $$
DECLARE
  pfx         text := 'tst5000';
  n_sup       int  := 2;   -- ← 2 supervisores por coordenador
  n_lider     int  := 3;   -- ← 3 líderes por supervisor
  n_anl       int  := 5;   -- ← 5 analistas por líder
  n_asst      int  := 5;   -- ← 5 assistentes por líder
  n_apr       int  := 2;   -- ← 2 aprendizes por assistente
  n_spec_asst int  := 350;
  n_spec_apr  int  := 150;

  sec_names text[] := ARRAY[
    'Produção','Qualidade','Logística','Manutenção',
    'Financeiro','Contabilidade','Recursos Humanos','Jurídico',
    'Tecnologia da Informação','Marketing','Vendas','Compras',
    'Segurança Patrimonial','SST','Administrativo','Almoxarifado',
    'Expedição','Serviços Gerais'
  ];
  sec_colors text[] := ARRAY[
    '#f87171','#fb923c','#fbbf24','#a3e635',
    '#34d399','#22d3ee','#60a5fa','#818cf8',
    '#c084fc','#f472b6','#fb7185','#4ade80',
    '#2dd4bf','#38bdf8','#a78bfa','#e879f9',
    '#facc15','#86efac'
  ];
  gg_of_sec int[] := ARRAY[1,1,1,1, 2,2,2,2, 3,3,3,3, 4,4,4, 5,5,5];
  gg_people text[] := ARRAY[
    'Roberto Alves','Fernanda Costa','Marcelo Santos','Juliana Melo','Pedro Gomes'
  ];
  gg_roles text[] := ARRAY[
    'Gerência Geral de Operações','Gerência Geral Financeira',
    'Gerência Geral de Suporte','Gerência Geral Comercial',
    'Gerência Geral Administrativa'
  ];
  dir_names text[] := ARRAY[
    'Ana Lima','Bruno Torres','Carla Neves','Daniel Rocha','Elisa Pinto',
    'Fábio Matos','Gabriela Cruz','Henrique Dias','Isabela Martins','João Cardoso',
    'Karen Almeida','Lucas Barros','Mariana Fonseca','Nícolas Braga','Olívia Saraiva',
    'Paulo Teixeira','Rafaela Moura','Sandro Viana'
  ];

  seq     int := 0;
  s       int; ss int; ksup int; klid int; kanl int; kasst int; kapr int;
  sid     text; id_coord text; id_sup text; id_lid text; id_asst text;
BEGIN
  INSERT INTO organograma.org_nodes
    (id,name,role,level,parent_id,is_sector,photo_url,sector_color,sector_director_of)
  VALUES (pfx||'-dir','Ana & Carlos Oliveira','Diretoria Geral',0,NULL,false,NULL,NULL,NULL);

  FOR s IN 1..5 LOOP
    INSERT INTO organograma.org_nodes VALUES (
      pfx||'-gg-'||s, gg_people[s], gg_roles[s],
      1, pfx||'-dir', false, NULL, NULL, NULL
    );
  END LOOP;

  FOR s IN 1..18 LOOP
    INSERT INTO organograma.org_nodes VALUES (
      pfx||'-sec-'||s, sec_names[s], 'Setor',
      2, pfx||'-gg-'||gg_of_sec[s], true, NULL, sec_colors[s], NULL
    );
    INSERT INTO organograma.org_nodes VALUES (
      pfx||'-sdir-'||s, dir_names[s], 'Diretoria de '||sec_names[s],
      0, NULL, false, NULL, NULL, pfx||'-sec-'||s
    );
    INSERT INTO organograma.org_nodes VALUES (
      pfx||'-sub-'||s||'a', sec_names[s]||' — Área A', 'Sub-setor',
      3, pfx||'-sec-'||s, true, NULL, sec_colors[s], NULL
    );
    INSERT INTO organograma.org_nodes VALUES (
      pfx||'-sub-'||s||'b', sec_names[s]||' — Área B', 'Sub-setor',
      3, pfx||'-sec-'||s, true, NULL, sec_colors[s], NULL
    );
  END LOOP;

  FOR s IN 1..17 LOOP
    seq := seq + 1;
    INSERT INTO organograma.org_nodes VALUES (
      pfx||'-p-'||lpad(seq::text,5,'0'),
      'Gerente '||s, 'Gerente de '||sec_names[s],
      3, pfx||'-sec-'||s, false, NULL, NULL, NULL
    );

    FOR ss IN 1..2 LOOP
      sid := pfx||'-sub-'||s||(CASE ss WHEN 1 THEN 'a' ELSE 'b' END);
      seq := seq + 1;
      id_coord := pfx||'-p-'||lpad(seq::text,5,'0');
      INSERT INTO organograma.org_nodes VALUES (
        id_coord, 'Coordenador '||s||'.'||ss,
        'Coordenador de '||sec_names[s],
        4, sid, false, NULL, NULL, NULL
      );

      FOR ksup IN 1..n_sup LOOP
        seq := seq + 1;
        id_sup := pfx||'-p-'||lpad(seq::text,5,'0');
        INSERT INTO organograma.org_nodes VALUES (
          id_sup, 'Supervisor '||s||'.'||ss||'.'||ksup,
          'Supervisor de '||sec_names[s],
          5, id_coord, false, NULL, NULL, NULL
        );

        FOR klid IN 1..n_lider LOOP
          seq := seq + 1;
          id_lid := pfx||'-p-'||lpad(seq::text,5,'0');
          INSERT INTO organograma.org_nodes VALUES (
            id_lid, 'Líder '||s||'.'||ss||'.'||ksup||'.'||klid,
            'Líder de Equipe',
            6, id_sup, false, NULL, NULL, NULL
          );
          FOR kanl IN 1..n_anl LOOP
            seq := seq + 1;
            INSERT INTO organograma.org_nodes VALUES (
              pfx||'-p-'||lpad(seq::text,5,'0'),
              'Analista '||s||'.'||ss||'.'||klid||'.'||kanl, 'Analista Técnico',
              7, id_lid, false, NULL, NULL, NULL
            );
          END LOOP;
          FOR kasst IN 1..n_asst LOOP
            seq := seq + 1;
            id_asst := pfx||'-p-'||lpad(seq::text,5,'0');
            INSERT INTO organograma.org_nodes VALUES (
              id_asst, 'Assistente '||s||'.'||ss||'.'||klid||'.'||kasst,
              'Assistente / Auxiliar',
              8, id_lid, false, NULL, NULL, NULL
            );
            FOR kapr IN 1..n_apr LOOP
              seq := seq + 1;
              INSERT INTO organograma.org_nodes VALUES (
                pfx||'-p-'||lpad(seq::text,5,'0'),
                'Aprendiz '||s||'.'||ss||'.'||kasst||'.'||kapr, 'Aprendiz',
                9, id_asst, false, NULL, NULL, NULL
              );
            END LOOP;
          END LOOP;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;

  FOR kasst IN 1..n_spec_asst LOOP
    seq := seq + 1;
    id_asst := pfx||'-p-'||lpad(seq::text,5,'0');
    INSERT INTO organograma.org_nodes VALUES (
      id_asst, 'Auxiliar SG '||kasst, 'Auxiliar de Serviços Gerais',
      8, pfx||'-sec-18', false, NULL, NULL, NULL
    );
  END LOOP;
  FOR kapr IN 1..n_spec_apr LOOP
    seq := seq + 1;
    INSERT INTO organograma.org_nodes VALUES (
      pfx||'-p-'||lpad(seq::text,5,'0'),
      'Aprendiz SG '||kapr, 'Aprendiz',
      9, pfx||'-sec-18', false, NULL, NULL, NULL
    );
  END LOOP;

  RAISE NOTICE 'tst5000 — % pessoas inseridas (total com estrutura: %)', seq, seq + 24;
END $$;
