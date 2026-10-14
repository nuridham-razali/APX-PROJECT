"""Offline LoRA starter. Run separately on a suitable CUDA machine with reviewed data.
Requires torch, transformers, datasets, peft, accelerate; no training runs at app startup.
"""
import argparse
from pathlib import Path
import torch
from datasets import load_dataset
from transformers import AutoTokenizer, AutoModelForCausalLM, Trainer, TrainingArguments, DataCollatorForSeq2Seq
from peft import LoraConfig, get_peft_model

parser=argparse.ArgumentParser()
parser.add_argument('--dataset',required=True)
parser.add_argument('--base',default='Qwen/Qwen2.5-7B-Instruct')
parser.add_argument('--output',default='training/output/apex-qwen-lora')
args=parser.parse_args()
if not torch.cuda.is_available(): raise SystemExit('Use a CUDA training machine; the live Ollama model is not modified by this script.')
rows=load_dataset('json',data_files=args.dataset,split='train')
if len(rows)<20: raise SystemExit('Collect at least 20 reviewed examples before running this starter; a larger varied dataset is needed for useful training.')
tokenizer=AutoTokenizer.from_pretrained(args.base)
if tokenizer.pad_token_id is None: tokenizer.pad_token=tokenizer.eos_token
def encode(row):
    messages=row['messages']
    if not messages or messages[-1]['role']!='assistant': raise ValueError('Each example must end with the approved assistant answer.')
    prefix=tokenizer.apply_chat_template(messages[:-1],tokenize=True,add_generation_prompt=True)
    full=tokenizer.apply_chat_template(messages,tokenize=True,add_generation_prompt=False)
    if len(full)>2048: raise ValueError('Shorten examples exceeding 2048 tokens; answers are never silently truncated.')
    if full[:len(prefix)]!=prefix: raise ValueError('Chat template prefix mismatch.')
    return {'input_ids':full,'attention_mask':[1]*len(full),'labels':[-100]*len(prefix)+full[len(prefix):]}
data=rows.map(encode,remove_columns=rows.column_names).train_test_split(test_size=.1,seed=42)
dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
model=AutoModelForCausalLM.from_pretrained(args.base,torch_dtype=dtype)
model=get_peft_model(model,LoraConfig(r=16,lora_alpha=32,lora_dropout=.05,target_modules='all-linear',task_type='CAUSAL_LM'))
model.config.use_cache=False
settings=TrainingArguments(output_dir=args.output,num_train_epochs=2,per_device_train_batch_size=1,gradient_accumulation_steps=8,learning_rate=2e-4,bf16=dtype==torch.bfloat16,fp16=dtype==torch.float16,logging_steps=5,save_strategy='epoch',eval_strategy='epoch',report_to='none',seed=42)
trainer=Trainer(model=model,args=settings,train_dataset=data['train'],eval_dataset=data['test'],data_collator=DataCollatorForSeq2Seq(tokenizer,padding=True,label_pad_token_id=-100))
trainer.train()
trainer.save_model(args.output)
tokenizer.save_pretrained(args.output)
print('Adapter saved. Evaluate it, then merge/convert to GGUF and import as a new Ollama model before switching APEX.')
