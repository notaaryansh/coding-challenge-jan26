This file is for documenting my thought process.


Match making process:
- Fruits have physical + aesthetic attributes
Physical {size, weight, hasChemicals}
Aesthetic {hasStem, hasLeaf, hasWorm, shineFactor}

The reason I decided to classify hasStem/hasLeaf as aesthetic attributes rather than physical is because the do not influence the physical aspects of a fruit. (There might be a correlation between the two, but ignoring it for the scope of this assignment).

My idea for matchmaking process is as follows:
- Return candidates pool based on hard preference.
- Do a set operation.
- Filter candidate pool by size preference.
- Check if query's attribute satisfy the candidate pool's preferences.
- Return top 'n'.
- if no match; return "Here'e someone with [x] -- fruit". 


Example Flow:
Apple is looking for orange:

"preferences": {
      "size": { "min": 5, "max": 12 },
      "hasWorm": false,
      "shineFactor": ["shiny", "extraShiny"]
      }

step 1) get subset A (oranges with shine factor = shiny), get subset B (oranges with shine factor = extra shiny) and subset C (oranges with no worms)

Step 2) Now we will do (A ∪ B) ∩ C - because shiny or extraShiny is acceptable.
which will return a new set lets call it D. 

Step 3) Once we have this new set D, we will further create a subset E,
which will have all the fruits matching the size range. 

Step 4) Once we have this set E; we will compare the preference of each fruit in E to the query fruit (Apple). 

Step 5) If we get a non null set; we will return it. If not; we can suggest some profiles which "softly" fit the preference. Ex: We couldnt find a fruit with your exact preference, but found 3 fruits which closely match your search criteria. 



Reason for this approach: When we have no match; I would prefer showing the nearest match, rather than no results at all. 


This also brings up an interesting case; what if query apple returns 5 candidate orange. And the apple satisfies none of the orange's preferences. 


To do:
- Early termination ? 
- do matching process for initial pool.
- create admin dashboard



Tying up things together; adding a new match table which will hold information about a match (could be in_progress or matched.). And have cascading updates if any of the fruits in the pool which belonged to other query; get updated. 


 When a new fruit arrives (let's say orange):                                                                       
  
  1. INSERT fruit (is_matched = false)                                                                                         
  2. QUERY candidate apples:                                                                                                 
     SELECT * FROM fruit WHERE type = "apple" AND is_matched = false
     ORDER BY (←in_progress_match_exists DESC), created_at ASC                                                                 
     — in_progress apples first (FIFO), then seed/never-tried by age                                                           
  3. RUN filter pipeline (existing matching.ts logic) → trace + passing IDs                                                    
  4. IF any passing:                                                                                                           
     a. winner = first passing apple (FIFO from sorted list)                                                                   
     b. BEGIN TRANSACTION                                                                                                      
          i.   Either UPDATE winner's in_progress match row OR INSERT new match row                                            
               with progress="matched", matched_at=now(), both fruit links set,                                                
               filter_trace = full trace from this evaluation                                                                  
          ii.  UPDATE both fruits SET is_matched = true                                                                        
          iii. CASCADE-CLEAN all other in_progress matches' filter_traces                                                    
       COMMIT TRANSACTION                                                                                                      
  5. ELSE:                                                                                                                   
     INSERT match row {                                                                                                        
       initiator: "orange",                                                                                                  
       apple: null,                                                                                                            
       orange: <new orange>,
       progress: "in_progress",                                                                                                
       filter_trace: full trace                                                                                              
     }

this is how we will cascade: 
UPDATE match                                                                                                               
  SET filter_trace.stages = filter_trace.stages.map(|$s| {
    field: $s.field,                                                                                                           
    operation: $s.operation,
    criteria: $s.criteria,                                                                                                     
    input_count: $s.input_count,                                                                                             
    passing_count: $s.passing_ids.filter(|$id| $id NOT IN [$matched_apple, $matched_orange]).len(),                            
    passing_ids: $s.passing_ids.filter(|$id| $id NOT IN [$matched_apple, $matched_orange])
  }),                                                                                                                          
  filter_trace.final_candidates = filter_trace.final_candidates.filter(|$id| $id NOT IN [$matched_apple, $matched_orange])   
  WHERE progress = "in_progress"                                                                                               
    AND id != $just_matched_row_id;                                                                                          
 


 look into what will happen if cascade fails mid match